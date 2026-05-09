import { Router } from 'express'
import * as footballData from '../providers/footballData.js'
import * as sportdb from '../providers/sportdb.js'
import { swr } from '../cache/swr.js'
import { handleError } from '../seed.js'

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
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
      return res.status(200).json({
        events: data.events.slice(0, sizeNum),
        status: data.status,
        providerStatus: data.providerStatus,
        provider: data.events[0]?.provider || null,
        league: requestedLeague,
        cacheSource: source,
        count: Math.min(data.events.length, sizeNum),
        totalAvailable: data.events.length,
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
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
    return res.status(200).json({
      events: data.events.slice(0, sizeNum),
      status: data.events.length > 0 ? 'ok' : 'empty',
      league: null,
      cacheSource: source,
      count: Math.min(data.events.length, sizeNum),
      totalAvailable: data.events.length,
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
