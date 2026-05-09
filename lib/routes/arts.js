import { Router } from 'express'
import * as curatedArts from '../providers/curatedArts.js'
import { swr } from '../cache/swr.js'
import { db } from '../db.js'
import { applyOverridesToList } from '../providers/applyOverrides.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { size = '20' } = req.query
    const sizeNum = Math.min(Math.max(parseInt(size, 10) || 20, 1), 50)
    const cacheKey = `arts:list`

    const { data, source } = await swr(
      cacheKey,
      () => curatedArts.fetchAll({ limit: 50 }),
      { ttlSeconds: 600, staleSeconds: 1800 },
    )

    const overrides = await db.listEventOverrides()
    const merged = applyOverridesToList(data.events, overrides)
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
    return res.status(200).json({
      events: merged.slice(0, sizeNum),
      status: data.status,
      providerStatus: data.providerStatus,
      cacheSource: source,
      count: Math.min(merged.length, sizeNum),
    })
  } catch (err) {
    console.error('[arts] failed:', err.message)
    return res.status(200).json({
      events: [],
      status: 'error',
      error: err.message,
    })
  }
})

export default router
