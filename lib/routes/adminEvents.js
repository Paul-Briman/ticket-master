import { Router } from 'express'
import { requireAdmin, requireAuth } from '../auth.js'
import { db } from '../db.js'
import * as footballData from '../providers/footballData.js'
import * as sportdb from '../providers/sportdb.js'
import * as curatedConcerts from '../providers/curatedConcerts.js'
import * as curatedArts from '../providers/curatedArts.js'
import * as curatedFamily from '../providers/curatedFamily.js'
import {
  applyEventOverride,
  applyOverridesToList,
} from '../providers/applyOverrides.js'
import { handleError } from '../seed.js'

// Aggregates every event the platform can show — across live providers
// AND curated catalogs — and merges admin overrides on top so the admin
// dashboard shows exactly what users see.
async function collectAllEvents() {
  const sportsLeagues = ['world-cup', 'ucl']
  const sportsLeaguesSDB = ['nba', 'nfl', 'f1', 'ufc', 'tennis', 'mlb', 'boxing']

  const tasks = []
  for (const l of sportsLeagues) tasks.push(footballData.fetchLeagueEvents(l))
  for (const l of sportsLeaguesSDB) tasks.push(sportdb.fetchLeagueEvents(l))
  tasks.push(curatedConcerts.fetchAll({ limit: 50 }))
  tasks.push(curatedArts.fetchAll({ limit: 50 }))
  tasks.push(curatedFamily.fetchAll({ limit: 50 }))

  const settled = await Promise.allSettled(tasks)
  const events = []
  for (const r of settled) {
    if (r.status === 'fulfilled' && Array.isArray(r.value?.events)) {
      events.push(...r.value.events)
    }
  }
  // Dedupe by id (in case the same event comes from multiple providers)
  const seen = new Set()
  return events.filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })
}

const router = Router()

// Auth + admin role guard for every route in this file.
router.use((req, res, next) => {
  try {
    const user = requireAuth(req)
    requireAdmin(user)
    req.adminUser = user
    next()
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message })
  }
})

// GET /api/admin/events — every event the platform can show, with admin
// overrides merged in.
router.get('/', async (req, res) => {
  try {
    const live = await collectAllEvents()
    const overrides = await db.listEventOverrides()
    const merged = applyOverridesToList(live, overrides)
    return res.status(200).json({
      events: merged,
      count: merged.length,
      overrideCount: Object.keys(overrides).length,
    })
  } catch (err) {
    return handleError(res, err, 'admin-events')
  }
})

// PATCH /api/admin/events/:id — write/update the admin override for an
// event. Body fields can include any of:
//   { title, image, venue, city, country, date, price,
//     pricing: { standard, premium, vip }, badge, badgeType }
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const body = req.body || {}
    if (!id) return res.status(400).json({ error: 'id is required' })

    const allowed = [
      'title',
      'image',
      'venue',
      'city',
      'country',
      'date',
      'price',
      'badge',
      'badgeType',
    ]
    const patch = {}
    for (const key of allowed) {
      if (body[key] !== undefined) patch[key] = body[key]
    }
    if (body.pricing && typeof body.pricing === 'object') {
      const p = {}
      if (body.pricing.standard !== undefined) p.standard = Number(body.pricing.standard) || 0
      if (body.pricing.premium !== undefined) p.premium = Number(body.pricing.premium) || 0
      if (body.pricing.vip !== undefined) p.vip = Number(body.pricing.vip) || 0
      if (Object.keys(p).length > 0) patch.pricing = p
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No editable fields provided' })
    }

    const stored = await db.setEventOverride(id, patch)
    console.log('[admin/events] override saved', { id, fields: Object.keys(patch) })
    return res.status(200).json({ ok: true, override: stored })
  } catch (err) {
    return handleError(res, err, 'admin-events-patch')
  }
})

// DELETE /api/admin/events/:id/override — clear all admin edits, revert
// to whatever the live provider returns.
router.delete('/:id/override', async (req, res) => {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ error: 'id is required' })
    await db.clearEventOverride(id)
    return res.status(200).json({ ok: true })
  } catch (err) {
    return handleError(res, err, 'admin-events-clear')
  }
})

// GET /api/admin/events/:id — single event with overrides applied (handy
// when the edit form needs the latest state).
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const live = await collectAllEvents()
    const event = live.find((e) => e.id === id)
    if (!event) return res.status(404).json({ error: 'Event not found' })
    const override = await db.getEventOverride(id)
    return res.status(200).json({
      event: applyEventOverride(event, override),
      override: override || null,
    })
  } catch (err) {
    return handleError(res, err, 'admin-event-detail')
  }
})

export default router
