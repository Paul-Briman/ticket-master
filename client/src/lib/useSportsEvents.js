import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'

// In-memory caches so re-mounting doesn't re-hit the network. Backend
// already caches in Vercel KV.
const memoryCache = new Map()
const inflight = new Map()

function paramsKey(params) {
  const entries = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
  return entries.map(([k, v]) => `${k}=${v}`).join('&') || '__default__'
}

export function useSportsEvents(params, { fallback = [], enabled = true } = {}) {
  const [events, setEvents] = useState(() => fallback)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)
  const [source, setSource] = useState('fallback')
  const fallbackRef = useRef(fallback)
  fallbackRef.current = fallback

  const key = paramsKey(params)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    let cancelled = false

    if (memoryCache.has(key)) {
      const cached = memoryCache.get(key)
      setEvents(cached.events)
      setSource(cached.source)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    let promise = inflight.get(key)
    if (!promise) {
      promise = api.sportsEvents(params).catch((err) => ({
        events: [],
        source: 'error',
        error: err.message,
      }))
      inflight.set(key, promise)
    }

    promise
      .then((data) => {
        inflight.delete(key)
        if (cancelled) return

        const liveEvents = Array.isArray(data?.events) ? data.events : []
        const baseSource = data?.source || 'unknown'

        // STRICT either/or: live data exists → use only live, never mix.
        // No live data → use curated fallback 100%, never mix.
        if (liveEvents.length > 0) {
          memoryCache.set(key, { events: liveEvents, source: baseSource })
          setEvents(liveEvents)
          setSource(baseSource)
          setError(null)
        } else {
          setEvents(fallbackRef.current)
          setSource('fallback')
          if (data?.error) setError(data.error)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  return {
    events,
    loading,
    error,
    source,
    isLive: source === 'live' || source === 'cache',
    isFallback: source === 'fallback',
  }
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
