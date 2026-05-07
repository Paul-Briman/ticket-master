import { Router } from 'express'
import {
  fetchNextLeagueEvents,
  fetchAllLeagues,
  fetchEventById,
  getCached,
  setCached,
  SPORTDB_LEAGUE_IDS,
} from '../sportdb.js'
import { handleError } from '../seed.js'

const TTL = 60 * 60 // 1 hour

const router = Router()

// GET /api/sports?league=nba&size=20  (also matches /api/sports)
router.get('/', async (req, res) => {
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
    console.error('[sports] failed:', err.message)
    res.setHeader('Cache-Control', 'no-store')
    return res
      .status(200)
      .json({ events: [], source: 'error', error: err.message })
  }
})

// GET /api/sports/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ error: 'id is required' })

    const sportsDbId = String(id).startsWith('sdb-')
      ? String(id).slice(4)
      : String(id)
    const cacheKey = `sdb:event:${sportsDbId}`

    const cached = await getCached(cacheKey)
    if (cached) {
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
      return res.status(200).json({ event: cached, source: 'cache' })
    }

    const event = await fetchEventById(sportsDbId)
    if (!event) return res.status(404).json({ error: 'Event not found' })

    await setCached(cacheKey, event, TTL)

    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
    return res.status(200).json({ event, source: 'live' })
  } catch (err) {
    return handleError(res, err, 'sports-event')
  }
})

export default router
