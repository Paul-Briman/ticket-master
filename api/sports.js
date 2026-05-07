import {
  fetchNextLeagueEvents,
  fetchAllLeagues,
  getCached,
  setCached,
  SPORTDB_LEAGUE_IDS,
} from '../lib/sportdb.js'
import { handleError, methodNotAllowed } from '../lib/seed.js'

const TTL = 60 * 60 // 1 hour

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  try {
    const { league = '', size = '20' } = req.query
    const sizeNum = Math.min(Math.max(parseInt(size, 10) || 20, 1), 50)
    const leagueKey = league && SPORTDB_LEAGUE_IDS[league] ? league : null

    const cacheKey = `sdb:events:${leagueKey || 'all'}:${sizeNum}`
    const cached = await getCached(cacheKey)
    if (cached) {
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
      return res.status(200).json({
        events: cached.slice(0, sizeNum),
        source: 'cache',
        league: leagueKey,
      })
    }

    let events
    if (leagueKey) {
      events = await fetchNextLeagueEvents(leagueKey)
    } else {
      events = await fetchAllLeagues()
    }
    events = events.slice(0, sizeNum)

    await setCached(cacheKey, events, TTL)

    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
    return res.status(200).json({ events, source: 'live', league: leagueKey })
  } catch (err) {
    console.error('[api/sports] failed:', err.message)
    res.setHeader('Cache-Control', 'no-store')
    return res
      .status(200)
      .json({ events: [], source: 'error', error: err.message })
  }
}
