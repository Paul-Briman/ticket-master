import { Router } from 'express'
import { requireAdmin, requireAuth } from '../auth.js'
import { db } from '../db.js'
import * as footballData from '../providers/footballData.js'
import * as sportdb from '../providers/sportdb.js'
import * as curatedConcerts from '../providers/curatedConcerts.js'
import * as curatedArts from '../providers/curatedArts.js'
import * as curatedFamily from '../providers/curatedFamily.js'
import { applyEventOverride, mergeWithSnapshot } from '../providers/applyOverrides.js'
import { defaultPricingTiers } from '../providers/normalize.js'
import { handleError } from '../seed.js'
import { annotateExpiry } from '../util/eventExpiry.js'

const ALLOWED_CATEGORIES = ['sports', 'concerts', 'arts', 'family']

const ADMIN_EVENT_ID_PREFIX = 'adm-'
const isAdminEventId = (id) => typeof id === 'string' && id.startsWith(ADMIN_EVENT_ID_PREFIX)

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

function slugifyCity(city) {
  return String(city || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function cleanTier(v) {
  if (v === undefined) return undefined
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

function normalizeAdminEventInput(body, { partial = false } = {}) {
  // Validates + normalizes admin event payload. Returns either
  // { ok: true, event } or { ok: false, error }.
  const errors = []

  if (!partial) {
    if (!body.title || typeof body.title !== 'string') errors.push('title is required')
    if (!body.category) errors.push('category is required')
  }
  if (body.category !== undefined && !ALLOWED_CATEGORIES.includes(body.category)) {
    errors.push(
      `category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`,
    )
  }

  // Pricing — required at create time, optional on partial update.
  let pricing
  if (body.pricing && typeof body.pricing === 'object') {
    const s = cleanTier(body.pricing.standard)
    const p = cleanTier(body.pricing.premium)
    const v = cleanTier(body.pricing.vip)
    if (s === null || p === null || v === null) {
      errors.push('pricing values must be non-negative numbers')
    } else {
      pricing = {}
      if (s !== undefined) pricing.standard = s
      if (p !== undefined) pricing.premium = p
      if (v !== undefined) pricing.vip = v
    }
  } else if (!partial) {
    errors.push('pricing.standard / pricing.premium / pricing.vip are required')
  }

  if (errors.length > 0) return { ok: false, error: errors.join('; ') }

  // Build the normalized event record. Fields that aren't supplied are
  // omitted on partial updates and defaulted on create.
  const out = {}
  const stringFields = [
    'title',
    'description',
    'category',
    'subcategory',
    'league',
    'sport',
    'venue',
    'city',
    'country',
    'date',
    'utcDate',
    'image',
    'thumbnail',
    'badge',
    'badgeType',
    'externalUrl',
    'organizer',
  ]
  for (const f of stringFields) {
    if (body[f] !== undefined) {
      out[f] =
        typeof body[f] === 'string' ? body[f].trim() : body[f]
    }
  }

  if (typeof body.featured === 'boolean') out.featured = body.featured
  if (typeof body.soldOut === 'boolean') out.soldOut = body.soldOut

  if (!partial) {
    if (!out.image && body.thumbnail) out.image = body.thumbnail
    if (!out.thumbnail && out.image) out.thumbnail = out.image
  }

  if (!partial && !out.date && !out.utcDate) {
    return { ok: false, error: 'date or utcDate is required' }
  }

  // Derive citySlug whenever city is supplied.
  if (out.city) out.citySlug = slugifyCity(out.city)

  // On create: backfill missing pricing tiers from a sensible default
  // (so seat generation never sees undefined/NaN). On partial update,
  // we only persist the tiers the admin sent.
  if (!partial) {
    if (!pricing) pricing = {}
    const seed = `${out.title || 'admin-event'}|${out.category}`
    const defaults = defaultPricingTiers(seed, out.category, pricing.standard)
    out.pricing = {
      standard: pricing.standard ?? defaults.standard,
      premium: pricing.premium ?? defaults.premium,
      vip: pricing.vip ?? defaults.vip,
    }
    out.price = `$${out.pricing.standard}`
  } else if (pricing) {
    out.pricing = pricing
    if (pricing.standard != null) out.price = `$${pricing.standard}`
  }

  return { ok: true, event: out }
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

// GET /api/admin/events?status=upcoming|expired|all — every event the
// platform can show, annotated with `expired` so the admin UI can split
// upcoming vs historical. Default is `all` so admins see everything.
router.get('/', async (req, res) => {
  try {
    const statusFilter = String(req.query.status || 'all').toLowerCase()
    const live = await collectAllEvents()
    const adminEvents = await db.listAdminEvents()

    const snapshots = await db.snapshotEvents(live)
    const overrides = await db.listEventOverrides()

    const liveMerged = live.map((event) => {
      const withSnapshot = mergeWithSnapshot(event, snapshots[event.id])
      return overrides[event.id]
        ? applyEventOverride(withSnapshot, overrides[event.id])
        : withSnapshot
    })

    const adminMerged = adminEvents.map((e) => {
      const withOverride = overrides[e.id]
        ? applyEventOverride(e, overrides[e.id])
        : e
      return { ...withOverride, adminCreated: true }
    })

    // Annotate each row with `expired` + `startMs` so the UI can split
    // Upcoming / Expired tabs without re-parsing dates client-side.
    const now = Date.now()
    const annotated = [...adminMerged, ...liveMerged].map((e) =>
      annotateExpiry(e, now),
    )

    let upcomingCount = 0
    let expiredCount = 0
    for (const e of annotated) {
      if (e.expired) expiredCount += 1
      else upcomingCount += 1
    }

    let filtered = annotated
    if (statusFilter === 'upcoming') filtered = annotated.filter((e) => !e.expired)
    else if (statusFilter === 'expired') filtered = annotated.filter((e) => e.expired)

    return res.status(200).json({
      events: filtered,
      count: filtered.length,
      upcomingCount,
      expiredCount,
      adminCreatedCount: adminMerged.length,
      overrideCount: Object.keys(overrides).length,
      snapshotCount: Object.keys(snapshots).length,
      status: statusFilter,
    })
  } catch (err) {
    return handleError(res, err, 'admin-events')
  }
})

// POST /api/admin/events — create a new admin-managed event from
// scratch. Lives in the admin-events store; flows through every public
// list/detail endpoint just like a curated event would.
router.post('/', async (req, res) => {
  try {
    const body = req.body || {}
    const result = normalizeAdminEventInput(body, { partial: false })
    if (!result.ok) {
      return res.status(400).json({ error: result.error })
    }
    const created = await db.createAdminEvent(result.event)
    console.log('[admin/events] created', {
      id: created.id,
      category: created.category,
      title: created.title,
    })
    return res.status(201).json({ ok: true, event: created })
  } catch (err) {
    return handleError(res, err, 'admin-events-create')
  }
})

// PATCH /api/admin/events/:id — for admin-created events, mutates the
// record directly. For live events, writes/updates the override store.
// Body fields can include any of:
//   { title, description, image, thumbnail, venue, city, country,
//     date, utcDate, league, subcategory, sport, organizer,
//     externalUrl, featured, soldOut, badge, badgeType, price,
//     pricing: { standard, premium, vip } }
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const body = req.body || {}
    if (!id) return res.status(400).json({ error: 'id is required' })

    if (isAdminEventId(id)) {
      // Direct update path — admin owns the record.
      const result = normalizeAdminEventInput(body, { partial: true })
      if (!result.ok) return res.status(400).json({ error: result.error })

      const updated = await db.updateAdminEvent(id, result.event)
      if (!updated) return res.status(404).json({ error: 'Admin event not found' })
      console.log('[admin/events] admin event updated', {
        id,
        fields: Object.keys(result.event),
      })
      return res.status(200).json({ ok: true, event: updated })
    }

    // Live / curated event — overlay through the override store so the
    // upstream record stays untouched. `utcDate` is accepted so admin
    // can pin the exact expiry moment (auto-derived from `date` if
    // omitted by applyEventOverride; explicit here is still allowed).
    const allowed = [
      'title',
      'image',
      'venue',
      'city',
      'country',
      'date',
      'utcDate',
      'price',
      'badge',
      'badgeType',
    ]
    const patch = {}
    for (const key of allowed) {
      if (body[key] !== undefined) patch[key] = body[key]
    }
    if (body.pricing && typeof body.pricing === 'object') {
      const s = cleanTier(body.pricing.standard)
      const m = cleanTier(body.pricing.premium)
      const v = cleanTier(body.pricing.vip)
      if (s === null || m === null || v === null) {
        return res
          .status(400)
          .json({ error: 'Pricing values must be non-negative numbers' })
      }
      const p = {}
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

// DELETE /api/admin/events/:id — only valid for admin-created events.
// Live events can't be deleted from the platform (they come back from
// the provider on every read); use the /override endpoint instead.
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ error: 'id is required' })
    if (!isAdminEventId(id)) {
      return res.status(400).json({
        error: 'Only admin-created events can be deleted. Use /override to revert a live event.',
      })
    }
    const removed = await db.deleteAdminEvent(id)
    if (!removed) return res.status(404).json({ error: 'Admin event not found' })
    // Clean up any override that may have been written for this id —
    // dangling overrides on a deleted record are harmless but messy.
    await db.clearEventOverride(id)
    console.log('[admin/events] admin event deleted', { id })
    return res.status(200).json({ ok: true })
  } catch (err) {
    return handleError(res, err, 'admin-events-delete')
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

    if (isAdminEventId(id)) {
      const event = await db.getAdminEvent(id)
      if (!event) return res.status(404).json({ error: 'Event not found' })
      return res.status(200).json({ event, adminCreated: true })
    }

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
