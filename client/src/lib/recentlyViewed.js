import { useCallback, useEffect, useState } from 'react'
import { isEventVisible } from './eventExpiry.js'
import { api } from './api.js'

const KEY = 'tm_recently_viewed'
const MAX = 12

// Fields we snapshot into localStorage. Kept minimal so the shrunk
// entry stays small; must include everything <EventCard/> reads so
// the card can render immediately from cache before revalidation
// completes. `pricing` + `promotion` were added so the strikethrough
// and discount badge survive a revalidation round-trip.
const STORED_FIELDS = [
  'id',
  'title',
  'date',
  'utcDate',
  'image',
  'venue',
  'city',
  'country',
  'price',
  'pricing',
  'promotion',
  'category',
  'league',
  'badge',
  'badgeType',
  'homeTeam',
  'awayTeam',
  'homeCrest',
  'awayCrest',
  'provider',
]

function shrink(event) {
  if (!event || !event.id) return null
  const out = {}
  for (const f of STORED_FIELDS) {
    if (event[f] !== undefined) out[f] = event[f]
  }
  return out
}

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(raw)) return []
    // Drop legacy id-only entries — we don't fabricate metadata.
    // Also strip events whose start time has passed so the homepage
    // lane never advertises something the user can't actually buy.
    return raw
      .filter((e) => e && typeof e === 'object' && e.id)
      .filter((e) => isEventVisible(e))
  } catch {
    return []
  }
}

function write(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)))
  } catch {
    // Quota errors — silently drop; the lane just won't persist.
  }
}

export function recordRecentView(event) {
  if (!event?.id) return
  const snapshot = shrink(event)
  if (!snapshot) return
  const list = read().filter((e) => e.id !== snapshot.id)
  list.unshift(snapshot)
  write(list)
}

/**
 * Revalidate every stored snapshot against /api/events/:id and
 * return a new list with fresh data.
 *
 * Per-entry outcomes:
 *   - 200 success           → replace the snapshot with fresh
 *                             STORED_FIELDS (identity preserved via
 *                             the same id, so no duplicate rows)
 *   - 404 (event gone)      → drop from the list
 *   - any other error       → keep the stale entry, try again on
 *                             next mount. Never break the lane on
 *                             a transient network hiccup.
 *
 * Runs in parallel so total latency is bounded by the slowest
 * request, not the sum. The list is short (max 12) and each hit is
 * served from a 30s edge cache after the first request, so this is
 * cheap even for repeat visitors.
 */
async function revalidateSnapshots(items) {
  if (!items.length) return items
  const results = await Promise.allSettled(
    items.map((it) => api.event(it.id)),
  )
  const next = []
  for (let i = 0; i < items.length; i += 1) {
    const prior = items[i]
    const r = results[i]
    if (r.status === 'fulfilled' && r.value?.event) {
      const fresh = shrink(r.value.event)
      // Preserve the prior snapshot as a fallback if shrink somehow
      // returned nothing — never lose a row to a shape hiccup.
      next.push(fresh || prior)
    } else if (r.status === 'rejected' && r.reason?.status === 404) {
      // Event was hard-deleted from the admin dashboard — drop it
      // from the lane so we don't advertise an unreachable URL.
      continue
    } else {
      // Network / 5xx / any other transient failure — keep the
      // stale entry. The next homepage mount will try again.
      next.push(prior)
    }
  }
  // Filter expired one more time — the fresh backend response
  // includes the current `expired` flag which might have flipped
  // since the snapshot was taken.
  return next.filter((e) => isEventVisible(e))
}

export function useRecentlyViewed() {
  const [items, setItems] = useState([])

  useEffect(() => {
    // 1. Instant paint from localStorage — may be stale, but the
    // user sees the lane immediately.
    const initial = read()
    setItems(initial)

    let cancelled = false

    // 2. Background revalidation. Any admin edit made since the
    // snapshot was taken (title, image, venue, pricing, promotion,
    // etc.) is now reflected because /api/events/:id is the same
    // DB-first endpoint that renders the detail page (with admin
    // overrides + promotion decoration already applied by the
    // backend). If an event was deleted, it's dropped here.
    if (initial.length > 0) {
      revalidateSnapshots(initial)
        .then((fresh) => {
          if (cancelled) return
          write(fresh)
          setItems(fresh)
        })
        .catch(() => {
          // Never let a revalidation failure clear the lane.
        })
    }

    function onStorage(e) {
      if (e.key === KEY) setItems(read())
    }
    window.addEventListener('storage', onStorage)
    return () => {
      cancelled = true
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const refresh = useCallback(() => setItems(read()), [])
  return { recent: items, refresh }
}
