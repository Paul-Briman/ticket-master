import { Router } from 'express'
import { requireAdmin, requireAuth } from '../auth.js'
import { db } from '../db.js'
import * as footballData from '../providers/footballData.js'
import * as sportdb from '../providers/sportdb.js'
import * as curatedConcerts from '../providers/curatedConcerts.js'
import * as curatedArts from '../providers/curatedArts.js'
import * as curatedFamily from '../providers/curatedFamily.js'
import { applyEventOverride } from '../providers/applyOverrides.js'
import { handleError } from '../seed.js'

// Merge the snapshot's stored fields onto a live event so blanks in the
// current API response get backfilled with the best data we ever saw.
// Live takes precedence when it has something — snapshot only fills gaps.
const SNAPSHOT_BACKFILL_FIELDS = [
  'title',
  'venue',
  'city',
  'citySlug',
  'country',
  'image',
  'date',
  'utcDate',
  'homeTeam',
  'awayTeam',
  'homeCrest',
  'awayCrest',
  'price',
  'badge',
  'badgeType',
]

function mergeWithSnapshot(live, snapshot) {
  if (!snapshot) return live
  const merged = { ...live }
  for (const field of SNAPSHOT_BACKFILL_FIELDS) {
    const liveVal = live[field]
    const snapVal = snapshot[field]
    const liveEmpty = liveVal === '' || liveVal === null || liveVal === undefined
    if (liveEmpty && snapVal != null && snapVal !== '') {
      merged[field] = snapVal
    }
  }
  // Pricing: tier-by-tier — live tier wins if present, snapshot fills gaps.
  const livePricing = live.pricing || {}
  const snapPricing = snapshot.pricing || {}
  merged.pricing = {
    standard: livePricing.standard ?? snapPricing.standard,
    premium: livePricing.premium ?? snapPricing.premium,
    vip: livePricing.vip ?? snapPricing.vip,
  }
  return merged
}

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

// GET /api/admin/events — every event the platform can show, with the
// canonical DB snapshot merged in (so previously-seen metadata fills any
// blanks in the current API response) and admin overrides on top.
router.get('/', async (req, res) => {
  try {
    const live = await collectAllEvents()

    // Persist every live event to the snapshot store so the admin form
    // is always pre-populated even if the upstream provider later drops
    // a field (e.g. football-data free tier omits city/country).
    const snapshots = await db.snapshotEvents(live)
    const overrides = await db.listEventOverrides()

    const merged = live.map((event) => {
      const withSnapshot = mergeWithSnapshot(event, snapshots[event.id])
      return overrides[event.id]
        ? applyEventOverride(withSnapshot, overrides[event.id])
        : withSnapshot
    })

    return res.status(200).json({
      events: merged,
      count: merged.length,
      overrideCount: Object.keys(overrides).length,
      snapshotCount: Object.keys(snapshots).length,
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
      // Reject anything that isn't a finite, non-negative number — never
      // let NaN / -1 / 'abc' land in the override store, since downstream
      // seat-pricing math (and the admin form pre-fill) relies on these
      // values being valid numbers.
      const cleanTier = (v) => {
        if (v === undefined) return undefined
        const n = typeof v === 'number' ? v : Number(v)
        if (!Number.isFinite(n) || n < 0) return null
        return n
      }
      const s = cleanTier(body.pricing.standard)
      const m = cleanTier(body.pricing.premium)
      const v = cleanTier(body.pricing.vip)
      if (s === null || m === null || v === null) {
        return res.status(400).json({
          error: 'Pricing values must be non-negative numbers',
        })
      }
      if (s !== undefined) p.standard = s
      if (m !== undefined) p.premium = m
      if (v !== undefined) p.vip = v
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

// GET /api/admin/events/:id — single event with snapshot+override merged
// so the edit form always sees pre-populated, consistent fields. Falls
// back to the snapshot alone if the live API no longer surfaces this id.
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const live = await collectAllEvents()
    const liveEvent = live.find((e) => e.id === id) || null
    const snapshot = await db.getEventSnapshot(id)
    const override = await db.getEventOverride(id)

    const base = liveEvent
      ? mergeWithSnapshot(liveEvent, snapshot)
      : snapshot
    if (!base) return res.status(404).json({ error: 'Event not found' })

    return res.status(200).json({
      event: override ? applyEventOverride(base, override) : base,
      override: override || null,
      snapshotted: !!snapshot,
      live: !!liveEvent,
    })
  } catch (err) {
    return handleError(res, err, 'admin-event-detail')
  }
})

export default router
