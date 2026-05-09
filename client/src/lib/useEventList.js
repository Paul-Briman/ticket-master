import { useEffect, useState } from 'react'
import { api } from './api.js'

const memoryCache = new Map()
const inflight = new Map()

const FETCHERS = {
  concerts: (p) => api.concerts(p),
  arts: (p) => api.arts(p),
  family: (p) => api.family(p),
}

function paramsKey(category, params) {
  const entries = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
  const tail = entries.map(([k, v]) => `${k}=${v}`).join('&') || '__default__'
  return `${category}|${tail}`
}

/**
 * Fetches a normalized event list from the backend. Strict either/or
 * semantics: whatever the API returns, the UI renders. The frontend
 * never knows whether the data is live or curated — that's hidden in
 * the backend adapter layer.
 */
export function useEventList(category, params = {}, { enabled = true } = {}) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('loading')

  const key = paramsKey(category, params)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    const fetcher = FETCHERS[category]
    if (!fetcher) {
      setLoading(false)
      setStatus('unsupported')
      return
    }

    let cancelled = false

    if (memoryCache.has(key)) {
      const cached = memoryCache.get(key)
      setEvents(cached.events)
      setStatus(cached.status)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    let promise = inflight.get(key)
    if (!promise) {
      promise = fetcher(params).catch((err) => ({
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
        memoryCache.set(key, { events: evs, status: st })
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
