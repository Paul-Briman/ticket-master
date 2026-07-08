import { useEffect, useState } from 'react'
import { api } from './api.js'

// Module-level cache so the Home page + any future consumer share the
// same fetched list without duplicate requests. Cleared explicitly
// after an admin save so the homepage reflects the change on the very
// next mount rather than waiting out the 30s CDN TTL.
let cached = null
let inflight = null

/**
 * Fetch every event currently marked `featured: true` across every
 * source (admin-created events + overrides on curated/live events).
 * Response events carry the same fields as list-endpoint events —
 * promotion decoration, expiry filter, override merge — so downstream
 * rendering is identical to a natural lane fetch.
 *
 * Returns `{ events, loading }`. `events` is always an array (empty
 * during loading or on network failure — never null).
 */
export function useHomepageFeatured() {
  const [events, setEvents] = useState(() => (cached ?? []))
  const [loading, setLoading] = useState(cached === null)

  useEffect(() => {
    if (cached !== null) {
      setEvents(cached)
      setLoading(false)
      return
    }
    let cancelled = false
    if (!inflight) {
      inflight = api
        .homepageFeatured()
        .then((res) => (Array.isArray(res?.events) ? res.events : []))
        .catch(() => [])
        .finally(() => {
          inflight = null
        })
    }
    inflight.then((list) => {
      if (cancelled) return
      cached = list
      setEvents(list)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { events, loading }
}

/**
 * Called from admin save handlers after a PATCH/POST/DELETE that could
 * have changed which events are featured. Next homepage mount will
 * re-fetch immediately instead of using the stale module-level cache.
 */
export function invalidateHomepageFeaturedCache() {
  cached = null
  inflight = null
}
