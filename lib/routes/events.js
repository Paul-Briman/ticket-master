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

const router = Router()

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
      const event = { ...merged, expired: isEventExpired(merged) }
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

    // 4. Admin override is final word.
    const override = await db.getEventOverride(id)
    const overridden = override ? applyEventOverride(base, override) : base
    // 5. Annotate expiry so the public detail page can render an
    // "Event has ended" state and the frontend can block purchase.
    const event = { ...overridden, expired: isEventExpired(overridden) }

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
