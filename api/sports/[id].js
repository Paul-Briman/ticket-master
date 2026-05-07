import {
  fetchEventById,
  getCached,
  setCached,
} from '../../lib/sportdb.js'
import { handleError, methodNotAllowed } from '../../lib/seed.js'

const TTL = 60 * 60

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  try {
    const { id } = req.query
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
}
