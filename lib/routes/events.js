// Unified event detail endpoint. Frontend hits this for EVERY event
// regardless of category — sports, concerts, arts, family. The route
// implements the canonical merge order:
//
//   1. Live API fetch (cached briefly via SWR)
//   2. DB snapshot (fills any field the live response is missing)
//   3. Admin override (highest priority — wins on every field it sets)
//
// The DB snapshot is also written back on every successful live fetch
// so future loads survive provider regressions and stale ids.

import { Router } from 'express'
import * as footballData from '../providers/footballData.js'
import * as sportdb from '../providers/sportdb.js'
import * as curatedConcerts from '../providers/curatedConcerts.js'
import * as curatedArts from '../providers/curatedArts.js'
import * as curatedFamily from '../providers/curatedFamily.js'
import { db } from '../db.js'
import {
  applyEventOverride,
  mergeWithSnapshot,
} from '../providers/applyOverrides.js'
import { swr } from '../cache/swr.js'
import { isEventExpired } from '../util/eventExpiry.js'
import { applyPromotionsToEvent } from '../util/promotionEngine.js'
import { ensurePromotionsSeeded } from './promotions.js'

// Curated event ids are short-prefixed in the catalog: 'c-' = concerts,
// 'a-' = arts, 'f-' = family. Route to the one provider we need rather
// than fanning out to all three.
async function findInCurated(id) {
  const s = String(id)
  let task = null
  if (s.startsWith('c-')) task = curatedConcerts.fetchAll({ limit: 200 })
  else if (s.startsWith('a-')) task = curatedArts.fetchAll({ limit: 200 })
  else if (s.startsWith('f-')) task = curatedFamily.fetchAll({ limit: 200 })
  if (!task) return null
  try {
    const result = await task
    return Array.isArray(result?.events)
      ? result.events.find((e) => e.id === id) || null
      : null
  } catch {
    return null
  }
}

async function fetchLiveEvent(id) {
  if (!id) return null
  if (String(id).startsWith('fd-')) return await footballData.fetchEventById(id)
  if (String(id).startsWith('sdb-')) return await sportdb.fetchEventById(id)
  return await findInCurated(id)
}

// Resolve a bare event id → the fully-merged event (base + override
// + promotion) exactly the way the detail endpoint would. Used by
// the homepage-featured collector below. Skipped: expiry check —
// the caller filters expired entries after promotion decoration.
async function resolveEventForFeatured(id, override) {
  const s = String(id)

  // Admin-created events live entirely in tm:admin-events. No live
  // provider indirection; the admin record IS the event.
  if (s.startsWith('adm-')) {
    const adminEvent = await db.getAdminEvent(id)
    if (!adminEvent) return null
    return override ? applyEventOverride(adminEvent, override) : adminEvent
  }

  // Snapshot is the fast path — writing the snapshot happens on
  // every detail visit, so any event an admin has already featured
  // is almost certainly snapshotted.
  const snapshot = await db.getEventSnapshot(id)
  if (snapshot) {
    return override ? applyEventOverride(snapshot, override) : snapshot
  }

  // Snapshot missing (rare): fall back to the same lookup the
  // detail endpoint uses (curated catalog for c-/a-/f- ids, live
  // provider otherwise). Failing that, we can't resolve — skip.
  const live = await fetchLiveEvent(id)
  if (!live) return null
  return override ? applyEventOverride(live, override) : live
}

const router = Router()

// GET /api/homepage-featured — every event currently marked
// featured=true (via admin-event record or via override), fully
// decorated (promotion applied, expired entries dropped). Home.jsx
// uses this to render "if any featured events exist for a section,
// show ONLY those" — the automatic per-lane fetch is the fallback
// for sections with zero featured entries.
// NOTE: this route is defined BEFORE '/:id' so Express matches it
// literally rather than treating 'homepage-featured' as an event id.
router.get('/homepage-featured', async (_req, res) => {
  try {
    const [overridesList, adminEvents, promotions] = await Promise.all([
      // listEventOverrides() returns a map keyed by id — we need both
      // the map (for pairing with admin ids) and the flat list (to
      // iterate every non-admin override with featured=true).
      db.listEventOverrides(),
      db.listAdminEvents(),
      (async () => {
        await ensurePromotionsSeeded()
        return db.listPromotions()
      })(),
    ])

    const featured = []
    const seenIds = new Set()

    // 1. Every admin-created event that's marked featured. Apply an
    // override on top if one exists so admin edits + featured status
    // combine correctly.
    for (const admin of adminEvents) {
      if (!admin || admin.featured !== true) continue
      const override = overridesList[admin.id]
      const merged = override ? applyEventOverride(admin, override) : admin
      if (merged?.featured !== true) continue
      seenIds.add(admin.id)
      featured.push(merged)
    }

    // 2. Every override on a NON-admin event whose featured=true.
    // (adm- ids handled above already.)
    for (const id of Object.keys(overridesList)) {
      if (String(id).startsWith('adm-')) continue
      const override = overridesList[id]
      if (!override || override.featured !== true) continue
      const resolved = await resolveEventForFeatured(id, override)
      if (!resolved || resolved.featured !== true) continue
      if (seenIds.has(resolved.id)) continue
      seenIds.add(resolved.id)
      featured.push(resolved)
    }

    // Promotion decoration + expiry filter — same layering the list
    // endpoints use, so a homepage-featured event's discount + badge
    // + strikethrough render identically to how they appear in a
    // natural lane fetch.
    const decorated = featured
      .map((e) => applyPromotionsToEvent(e, promotions))
      .filter((e) => !isEventExpired(e))

    // Short CDN cache so admin toggles surface within ~30s without
    // hammering the endpoint on every homepage load.
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30')
    return res.status(200).json({
      events: decorated,
      count: decorated.length,
    })
  } catch (err) {
    console.error('[events/homepage-featured] error', err.message)
    return res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  const { id } = req.params
  if (!id) return res.status(400).json({ error: 'id is required' })

  console.log('[events/:id] CLICK', { id })
  try {
    // Admin-created events live entirely in the admin-events store —
    // no live provider, no snapshot indirection. Apply any override
    // that may have been written, then return.
    if (String(id).startsWith('adm-')) {
      const adminEvent = await db.getAdminEvent(id)
      if (!adminEvent) {
        return res.status(404).json({ error: 'Event not found', id })
      }
      const override = await db.getEventOverride(id)
      const merged = override
        ? applyEventOverride(adminEvent, override)
        : adminEvent
      await ensurePromotionsSeeded()
      const promotions = await db.listPromotions()
      const decorated = applyPromotionsToEvent(merged, promotions)
      const event = { ...decorated, expired: isEventExpired(merged) }
      res.setHeader('Cache-Control', 'private, max-age=30')
      return res.status(200).json({
        event,
        sources: { snapshot: false, live: false, override: !!override, admin: true },
      })
    }

    // 1. Live (cached). Tolerates provider failure — null means "no fresh data".
    const cacheKey = `event:${id}`
    let live = null
    try {
      const result = await swr(cacheKey, () => fetchLiveEvent(id), {
        ttlSeconds: 600,
        staleSeconds: 1800,
      })
      live = result?.data || null
    } catch (err) {
      console.warn('[events/:id] live fetch failed', { id, error: err.message })
    }

    // 2. Snapshot from DB (the canonical persisted record). If live
    // fetch worked, write back in the background so the snapshot
    // accumulates richer data — never block the response on a slow
    // KV write since we still have the live data in hand.
    if (live) {
      db.snapshotEvents([live]).catch((err) =>
        console.warn('[events/:id] snapshot bg failed', { id, error: err.message }),
      )
    }
    const snapshot = await db.getEventSnapshot(id)

    // 3. Build base — DB snapshot is preferred when present (the
    // architecture rule: detail pages query DB first; live API is a
    // fallback that fills snapshot gaps). When both exist, snapshot
    // wins on everything except fields snapshot left empty.
    let base
    if (snapshot && live) {
      // mergeWithSnapshot returns "live with snapshot filling gaps".
      // For DB-first semantics we want the inverse: snapshot with live
      // filling the snapshot's gaps.
      base = mergeWithSnapshot(snapshot, live)
    } else if (snapshot) {
      base = snapshot
    } else if (live) {
      base = live
    } else {
      console.warn('[events/:id] not found in DB or live', { id })
      return res.status(404).json({
        error: 'Event not found',
        message:
          'No DB snapshot exists for this id and the live provider returned nothing.',
        id,
      })
    }

    // 4. Admin override is final word for base pricing/metadata.
    const override = await db.getEventOverride(id)
    const overridden = override ? applyEventOverride(base, override) : base
    // 5. Promotions decorate (additive — base pricing preserved).
    await ensurePromotionsSeeded()
    const promotions = await db.listPromotions()
    const decorated = applyPromotionsToEvent(overridden, promotions)
    // 6. Annotate expiry so the public detail page can render an
    // "Event has ended" state and the frontend can block purchase.
    const event = { ...decorated, expired: isEventExpired(overridden) }

    console.log('[events/:id] result', {
      id,
      hasSnapshot: !!snapshot,
      hasLive: !!live,
      hasOverride: !!override,
      expired: event.expired,
      title: event?.title,
    })

    res.setHeader('Cache-Control', 'private, max-age=30')
    return res.status(200).json({
      event,
      sources: {
        snapshot: !!snapshot,
        live: !!live,
        override: !!override,
      },
    })
  } catch (err) {
    console.error('[events/:id] error', { id, message: err.message })
    return res.status(500).json({ error: err.message })
  }
})

export default router
