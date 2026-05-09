import { useEffect, useState } from 'react'
import { api } from './api.js'

// Module-level cache so navigating away and back doesn't re-hit the
// network for the same event id (the backend already caches via SWR,
// but skipping the round-trip entirely is even faster on the client).
const memoryCache = new Map()
const inflight = new Map()

/**
 * Unified event detail hook. Hits the backend `/api/events/:id` endpoint
 * which implements:
 *
 *   DB snapshot (preferred) ⊕ live API (fills gaps) ⊕ admin override (final)
 *
 * Works for every category — sports, concerts, arts, family — so the
 * UI never needs to branch on category and admin pricing edits always
 * land on the detail page.
 */
export function useEvent(id, { enabled = true, seed = null } = {}) {
  const [event, setEvent] = useState(seed || null)
  const [loading, setLoading] = useState(enabled && !!id && !memoryCache.has(id))
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!enabled || !id) {
      setLoading(false)
      return
    }
    let cancelled = false

    if (memoryCache.has(id)) {
      setEvent(memoryCache.get(id))
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)

    let promise = inflight.get(id)
    if (!promise) {
      promise = api
        .event(id)
        .then((data) => data?.event || null)
        .catch((err) => {
          // Swallow here so we can surface a clean error in state below
          // without rejecting the cached promise.
          return { __error: err.message || 'Failed to load event' }
        })
      inflight.set(id, promise)
    }

    promise
      .then((result) => {
        inflight.delete(id)
        if (cancelled) return
        if (result && typeof result === 'object' && result.__error) {
          setError(result.__error)
          return
        }
        if (result) memoryCache.set(id, result)
        setEvent(result)
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

// Lets a consumer (e.g. admin override save handler) bust the cache so
// the next mount refetches fresh.
export function invalidateEventCache(id) {
  if (id) memoryCache.delete(id)
  else memoryCache.clear()
}
