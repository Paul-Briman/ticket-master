import { Router } from 'express'
import * as footballData from '../providers/footballData.js'
import * as sportdb from '../providers/sportdb.js'
import { swr, bustSwrCache } from '../cache/swr.js'
import { handleError } from '../seed.js'
import { db } from '../db.js'
import {
  applyEventOverride,
  applyOverridesToList,
  filterAdminEventsForCategory,
  mergeWithSnapshot,
} from '../providers/applyOverrides.js'
import { filterVisibleEvents, isEventVisible } from '../util/eventExpiry.js'
import {
  applyPromotionsToList,
  applyPromotionsToEvent,
} from '../util/promotionEngine.js'
import { ensurePromotionsSeeded } from './promotions.js'

const PROVIDER_FOR_LEAGUE = {
  'world-cup': 'football-data',
  ucl: 'football-data',
  nba: 'sportdb',
  nfl: 'sportdb',
  f1: 'sportdb',
  ufc: 'sportdb',
  tennis: 'sportdb',
  mlb: 'sportdb',
  boxing: 'sportdb',
}

export const SUPPORTED_LEAGUES = new Set(Object.keys(PROVIDER_FOR_LEAGUE))

async function fetchLeagueRaw(leagueKey) {
  const providerName = PROVIDER_FOR_LEAGUE[leagueKey]
  if (providerName === 'football-data') return await footballData.fetchLeagueEvents(leagueKey)
  if (providerName === 'sportdb') return await sportdb.fetchLeagueEvents(leagueKey)
  return { events: [], status: 'unsupported', providerStatus: 'unknown', leagueKey }
}

// Single-source cache for both list and counts endpoints. Counts are
// derived from the SAME cached, normalized, deduped event arrays the list
// endpoint returns — so /sports/counts and /sports?league=X can never
// disagree.
async function getLeagueData(leagueKey) {
  const cacheKey = `sports:${leagueKey}`
  const { data, source } = await swr(
    cacheKey,
    () => fetchLeagueRaw(leagueKey),
    { ttlSeconds: 600, staleSeconds: 1800 },
  )

  // CRITICAL: don't cache transient provider failures for 10 minutes.
  // If football-data or sportdb returned no events because of a rate
  // limit or network blip, bust the cache entry so the next request
  // refetches against upstream instead of serving an empty result for
  // the rest of the TTL window. A genuine empty result (provider
  // returned 200 with zero matches) leaves providerStatus === 'ok' and
  // is allowed to cache normally.
  const empty =
    !Array.isArray(data?.events) || data.events.length === 0
  const failed = data?.providerStatus && data.providerStatus !== 'ok'
  if (empty && failed) {
    console.warn(
      `[sports] busting cache for ${cacheKey} ` +
        `(provider=${data.providerStatus}, status=${data.status})`,
    )
    bustSwrCache(cacheKey).catch(() => {})
  }

  return { data, source }
}

const router = Router()

// IMPORTANT: /counts must be defined BEFORE /:id so Express doesn't treat
// "counts" as an event id.
router.get('/counts', async (req, res) => {
  try {
    const leagues = [...SUPPORTED_LEAGUES]
    const results = await Promise.allSettled(
      leagues.map(async (leagueKey) => {
        const { data } = await getLeagueData(leagueKey)
        return [leagueKey, Array.isArray(data?.events) ? data.events.length : 0]
      }),
    )
    const counts = {}
    for (const r of results) {
      if (r.status === 'fulfilled') {
        const [k, n] = r.value
        counts[k] = n
      }
    }
    res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=120')
    return res.status(200).json({ counts })
  } catch (err) {
    console.error('[sports/counts] failed:', err.message)
    return res.status(200).json({ counts: {}, error: err.message })
  }
})

// GET /api/sports                       → all leagues aggregated
// GET /api/sports?league=nba&size=20    → strictly that league
router.get('/', async (req, res) => {
  try {
    const { league = '', size = '20' } = req.query
    const sizeNum = Math.min(Math.max(parseInt(size, 10) || 20, 1), 50)
    const requestedLeague = String(league || '').trim()

    if (requestedLeague && !SUPPORTED_LEAGUES.has(requestedLeague)) {
      res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600')
      return res.status(200).json({
        events: [],
        status: 'unsupported',
        league: requestedLeague,
        message: `${requestedLeague} is not supported by any live provider.`,
      })
    }

    if (requestedLeague) {
      const { data, source } = await getLeagueData(requestedLeague)

      // TEMP debug for the world-cup regression report — surfaces the
      // exact upstream count, provider status, and cache source so we
      // can diagnose without a redeploy.
      if (requestedLeague === 'world-cup') {
        console.log(
          '[sports/world-cup] upstream =',
          JSON.stringify({
            cacheSource: source,
            count: data?.events?.length ?? 0,
            status: data?.status,
            providerStatus: data?.providerStatus,
            firstUtc: data?.events?.[0]?.utcDate || null,
            firstTitle: data?.events?.[0]?.title || null,
          }),
        )
      }

      // Best-effort snapshot — don't block the response on KV writes.
      // The unified /api/events/:id endpoint also snapshots on click,
      // so a missed write here just defers persistence by one detail
      // visit. NEVER await this — slow KV must not empty list pages.
      db.snapshotEvents(data.events).catch((err) =>
        console.warn(`[sports] snapshot bg failed for ${requestedLeague}:`, err.message),
      )
      const [overrides, adminEvents] = await Promise.all([
        db.listEventOverrides(),
        db.listAdminEvents(),
      ])
      await ensurePromotionsSeeded()
      const promotions = await db.listPromotions()
      const liveMerged = applyOverridesToList(data.events, overrides)
      const adminMerged = applyOverridesToList(
        filterAdminEventsForCategory(adminEvents, 'sports', requestedLeague),
        overrides,
      )
      const visible = filterVisibleEvents([...adminMerged, ...liveMerged])
      const merged = applyPromotionsToList(visible, promotions)
      // Short CDN cache (30s) so promotion edits propagate quickly.
      res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30')
      return res.status(200).json({
        events: merged.slice(0, sizeNum),
        status: data.status,
        providerStatus: data.providerStatus,
        provider: data.events[0]?.provider || null,
        league: requestedLeague,
        cacheSource: source,
        count: Math.min(merged.length, sizeNum),
        totalAvailable: merged.length,
      })
    }

    // Aggregate
    const cacheKey = 'sports:all'
    const { data, source } = await swr(
      cacheKey,
      async () => {
        const results = await Promise.allSettled(
          [...SUPPORTED_LEAGUES].map(async (l) => (await getLeagueData(l)).data),
        )
        const events = []
        for (const r of results) {
          if (r.status === 'fulfilled' && Array.isArray(r.value?.events)) {
            events.push(...r.value.events)
          }
        }
        return { events }
      },
      { ttlSeconds: 600, staleSeconds: 1800 },
    )
    db.snapshotEvents(data.events).catch((err) =>
      console.warn('[sports] snapshot bg failed for aggregate:', err.message),
    )
    const [overrides, adminEvents] = await Promise.all([
      db.listEventOverrides(),
      db.listAdminEvents(),
    ])
    await ensurePromotionsSeeded()
    const promotions = await db.listPromotions()
    const liveMerged = applyOverridesToList(data.events, overrides)
    const adminMerged = applyOverridesToList(
      filterAdminEventsForCategory(adminEvents, 'sports'),
      overrides,
    )
    const visible = filterVisibleEvents([...adminMerged, ...liveMerged])
    const merged = applyPromotionsToList(visible, promotions)
    // Short CDN cache (30s) so promotion edits propagate quickly.
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30')
    return res.status(200).json({
      events: merged.slice(0, sizeNum),
      status: merged.length > 0 ? 'ok' : 'empty',
      league: null,
      cacheSource: source,
      count: Math.min(merged.length, sizeNum),
      totalAvailable: merged.length,
    })
  } catch (err) {
    console.error('[sports] failed:', err.message)
    return res.status(200).json({
      events: [],
      status: 'error',
      error: err.message,
    })
  }
})

router.get('/:id', async (req, res) => {
  const { id } = req.params
  console.log('[sports/:id] CLICK', { id })

  try {
    if (!id) return res.status(400).json({ error: 'id is required' })

    // Admin-created sports event — served straight from the admin
    // events store with any override layered on top.
    if (String(id).startsWith('adm-')) {
      const adminEvent = await db.getAdminEvent(id)
      if (!adminEvent || adminEvent.category !== 'sports') {
        return res.status(404).json({ error: 'Event not found', id })
      }
      const override = await db.getEventOverride(id)
      const merged = override
        ? applyEventOverride(adminEvent, override)
        : adminEvent
      await ensurePromotionsSeeded()
      const promotions = await db.listPromotions()
      const decorated = applyPromotionsToEvent(merged, promotions)
      const event = { ...decorated, expired: !isEventVisible(merged) }
      return res.status(200).json({ event, provider: 'admin-created' })
    }

    let provider = null
    let providerId = null
    let endpoint = null
    let fetcher = null

    if (String(id).startsWith('sdb-')) {
      provider = 'sportdb'
      providerId = id.slice(4)
      endpoint = `https://www.thesportsdb.com/api/v1/json/<key>/lookupevent.php?id=${providerId}`
      fetcher = () => sportdb.fetchEventById(id)
    } else if (String(id).startsWith('fd-')) {
      provider = 'football-data'
      providerId = id.slice(3)
      endpoint = `https://api.football-data.org/v4/matches/${providerId}`
      fetcher = () => footballData.fetchEventById(id)
    } else {
      console.warn('[sports/:id] unrecognized prefix', { id })
      return res.status(404).json({
        error: 'Event not found',
        message: 'Unrecognized provider prefix. Expected sdb- or fd-.',
        id,
      })
    }

    console.log('[sports/:id] resolved', { id, provider, providerId, endpoint })

    const cacheKey = `sports:event:${id}`
    let live = null
    let source = 'fresh'
    try {
      const result = await swr(cacheKey, fetcher, {
        ttlSeconds: 900,
        staleSeconds: 3600,
      })
      live = result?.data || null
      source = result?.source || 'fresh'
    } catch (err) {
      console.warn('[sports/:id] live fetch failed', { id, error: err.message })
    }

    // Persist whatever the live fetch returned so future loads survive
    // provider gaps. Fire-and-forget: never block the response on a
    // slow KV write — the same id will be re-snapshotted on the next
    // detail click anyway.
    if (live) {
      db.snapshotEvents([live]).catch((err) =>
        console.warn('[sports/:id] snapshot bg failed', { id, error: err.message }),
      )
    }

    // DB-first: prefer the persisted snapshot when present; live data
    // only fills snapshot gaps. This guarantees admin pricing edits and
    // saved metadata reflect on the detail page even if the live API
    // momentarily drops the event.
    const snapshot = await db.getEventSnapshot(id)
    let base = null
    if (snapshot && live) base = mergeWithSnapshot(snapshot, live)
    else if (snapshot) base = snapshot
    else if (live) base = live

    console.log('[sports/:id] result', {
      id,
      provider,
      cacheSource: source,
      hasSnapshot: !!snapshot,
      hasLive: !!live,
      title: base?.title || null,
    })

    if (!base) {
      return res.status(404).json({
        error: 'Event not found',
        provider,
        providerId,
        id,
      })
    }

    const override = await db.getEventOverride(id)
    const overridden = override ? applyEventOverride(base, override) : base
    await ensurePromotionsSeeded()
    const promotions = await db.listPromotions()
    const decorated = applyPromotionsToEvent(overridden, promotions)
    const merged = { ...decorated, expired: !isEventVisible(overridden) }

    // Short CDN cache (30s) so promotion edits propagate quickly.
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30')
    return res.status(200).json({ event: merged, provider, cacheSource: source })
  } catch (err) {
    console.error('[sports/:id] error', { id, message: err.message })
    return handleError(res, err, 'sports-event')
  }
})

export default router
