import { Router } from 'express'
import * as curatedConcerts from '../providers/curatedConcerts.js'
import { swr } from '../cache/swr.js'
import { db } from '../db.js'
import { applyOverridesToList } from '../providers/applyOverrides.js'

// Concerts currently use the curated provider. Architecture is
// adapter-based so we can swap to Bandsintown / Songkick without any
// frontend changes — just update the provider import.

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { size = '20' } = req.query
    const sizeNum = Math.min(Math.max(parseInt(size, 10) || 20, 1), 50)
    const cacheKey = `concerts:trending`

    const { data, source } = await swr(
      cacheKey,
      () => curatedConcerts.fetchAll({ limit: 50 }),
      { ttlSeconds: 600, staleSeconds: 1800 },
    )

    // Best-effort snapshot — never block list response on KV writes.
    db.snapshotEvents(data.events).catch((err) =>
      console.warn('[concerts] snapshot bg failed:', err.message),
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
    console.error('[concerts] failed:', err.message)
    return res.status(200).json({
      events: [],
      status: 'error',
      error: err.message,
    })
  }
})

export default router
