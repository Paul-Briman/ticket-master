import { useEffect, useState } from 'react'
import { api } from './api.js'

// In-memory caches so re-mounting doesn't re-hit the network. Backend
// already does its own SWR cache via Vercel KV.
//
// Entries carry an `expiresAt` so a transient empty (e.g. a brief
// upstream rate-limit) can't lock the tab onto stale data forever —
// after the TTL the next consumer triggers a refetch.
const memoryCache = new Map()
const inflight = new Map()
const TTL_MS = 5 * 60 * 1000 // 5 minutes

function isFresh(entry) {
  return !!entry && entry.expiresAt > Date.now()
}

function paramsKey(params) {
  const entries = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
  return entries.map(([k, v]) => `${k}=${v}`).join('&') || '__default__'
}

/**
 * Strict live-only hook. Returns whatever the backend says — no
 * curated mock fallback, no merging. If the live provider is empty
 * or down, the consumer should render an empty state.
 */
/**
 * Drop every cached sports-events entry. Admin override saves call
 * this so the next render of any sports lane picks up the new data
 * instead of waiting out the TTL window with a stale array.
 */
export function invalidateSportsEventsCache() {
  memoryCache.clear()
  inflight.clear()
}

export function useSportsEvents(params, { enabled = true } = {}) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('loading')

  const key = paramsKey(params)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    let cancelled = false

    const cached = memoryCache.get(key)
    if (isFresh(cached)) {
      setEvents(cached.events)
      setStatus(cached.status)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    let promise = inflight.get(key)
    if (!promise) {
      promise = api.sportsEvents(params).catch((err) => ({
        events: [],
        status: 'error',
        error: err.message,
      }))
      inflight.set(key, promise)
    }

    promise
      .then((data) => {
        inflight.delete(key)
        if (cancelled) return
        const evs = Array.isArray(data?.events) ? data.events : []
        const st = data?.status || 'unknown'
        memoryCache.set(key, {
          events: evs,
          status: st,
          expiresAt: Date.now() + TTL_MS,
        })
        setEvents(evs)
        setStatus(st)
        if (data?.error) setError(data.error)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  return { events, loading, error, status }
}

export function useSportsEvent(id, { enabled = true } = {}) {
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(enabled && !!id)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!enabled || !id) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    api
      .sportsEvent(id)
      .then((data) => {
        if (cancelled) return
        setEvent(data?.event || null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
        setEvent(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, enabled])

  return { event, loading, error }
}
