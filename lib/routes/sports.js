import { Router } from 'express'
import * as footballData from '../providers/footballData.js'
import * as sportdb from '../providers/sportdb.js'
import { swr } from '../cache/swr.js'
import { handleError } from '../seed.js'

// Map our internal league keys to the provider that owns them.
// Football competitions (World Cup + UCL) come from football-data.org —
// it has authoritative fixture lists. Other sports come from TheSportsDB.
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

async function fetchLeague(leagueKey) {
  const providerName = PROVIDER_FOR_LEAGUE[leagueKey]
  if (providerName === 'football-data') {
    return await footballData.fetchLeagueEvents(leagueKey)
  }
  if (providerName === 'sportdb') {
    return await sportdb.fetchLeagueEvents(leagueKey)
  }
  return { events: [], status: 'unsupported', providerStatus: 'unknown', leagueKey }
}

const router = Router()

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
      const cacheKey = `sports:${requestedLeague}`
      const { data, source } = await swr(
        cacheKey,
        () => fetchLeague(requestedLeague),
        { ttlSeconds: 600, staleSeconds: 1800 },
      )
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
      return res.status(200).json({
        events: data.events.slice(0, sizeNum),
        status: data.status,
        providerStatus: data.providerStatus,
        provider: data.events[0]?.provider || null,
        league: requestedLeague,
        cacheSource: source,
        count: Math.min(data.events.length, sizeNum),
      })
    }

    // Aggregate across all supported leagues
    const cacheKey = 'sports:all'
    const { data, source } = await swr(
      cacheKey,
      async () => {
        const results = await Promise.allSettled(
          [...SUPPORTED_LEAGUES].map((l) => fetchLeague(l)),
        )
        const events = []
        for (const r of results) {
          if (r.status === 'fulfilled' && Array.isArray(r.value.events)) {
            events.push(...r.value.events)
          }
        }
        return { events }
      },
      { ttlSeconds: 600, staleSeconds: 1800 },
    )
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
    return res.status(200).json({
      events: data.events.slice(0, sizeNum),
      status: data.events.length > 0 ? 'ok' : 'empty',
      league: null,
      cacheSource: source,
      count: Math.min(data.events.length, sizeNum),
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

    // Routing is by id PREFIX, not normalized fields — preserves provider
    // identity end-to-end and prevents id remapping bugs.
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
    const { data, source } = await swr(cacheKey, fetcher, {
      ttlSeconds: 900,
      staleSeconds: 3600,
    })

    console.log('[sports/:id] result', {
      id,
      provider,
      cacheSource: source,
      found: !!data,
      title: data?.title || null,
    })

    if (!data) {
      return res.status(404).json({
        error: 'Event not found',
        provider,
        providerId,
        id,
      })
    }

    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
    return res.status(200).json({ event: data, provider, cacheSource: source })
  } catch (err) {
    console.error('[sports/:id] error', { id, message: err.message })
    return handleError(res, err, 'sports-event')
  }
})

export default router
