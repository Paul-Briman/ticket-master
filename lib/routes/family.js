import { Router } from 'express'
import * as curatedFamily from '../providers/curatedFamily.js'
import { swr } from '../cache/swr.js'
import { db } from '../db.js'
import {
  applyOverridesToList,
  filterAdminEventsForCategory,
} from '../providers/applyOverrides.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { size = '20' } = req.query
    const sizeNum = Math.min(Math.max(parseInt(size, 10) || 20, 1), 50)
    const cacheKey = `family:list`

    const { data, source } = await swr(
      cacheKey,
      () => curatedFamily.fetchAll({ limit: 50 }),
      { ttlSeconds: 600, staleSeconds: 1800 },
    )

    db.snapshotEvents(data.events).catch((err) =>
      console.warn('[family] snapshot bg failed:', err.message),
    )
    const [overrides, adminEvents] = await Promise.all([
      db.listEventOverrides(),
      db.listAdminEvents(),
    ])
    const curatedMerged = applyOverridesToList(data.events, overrides)
    const adminMerged = applyOverridesToList(
      filterAdminEventsForCategory(adminEvents, 'family'),
      overrides,
    )
    const merged = [...adminMerged, ...curatedMerged]
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
    return res.status(200).json({
      events: merged.slice(0, sizeNum),
      status: data.status,
      providerStatus: data.providerStatus,
      cacheSource: source,
      count: Math.min(merged.length, sizeNum),
    })
  } catch (err) {
    console.error('[family] failed:', err.message)
    return res.status(200).json({
      events: [],
      status: 'error',
      error: err.message,
    })
  }
})

export default router
