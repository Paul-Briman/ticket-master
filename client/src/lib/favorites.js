import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './auth.jsx'

const KEY_PREFIX = 'tm_favorites:'

// Fields we keep snapshotted on the favorite. Enough to render an
// EventCard without needing a server roundtrip.
const STORED_FIELDS = [
  'id',
  'title',
  'date',
  'image',
  'venue',
  'city',
  'country',
  'price',
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

function read(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]')
    if (!Array.isArray(raw)) return []
    // Migration: legacy strings (just ids) → drop them quietly. The user
    // can re-favorite. We don't have the metadata to render them and we
    // refuse to invent it from a mock catalog.
    return raw.filter((e) => e && typeof e === 'object' && e.id)
  } catch {
    return []
  }
}

function write(key, events) {
  localStorage.setItem(key, JSON.stringify(events))
}

export function useFavorites() {
  const { user } = useAuth()
  const key = user ? `${KEY_PREFIX}${user.email.toLowerCase()}` : null
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!key) {
      setItems([])
      return
    }
    setItems(read(key))
  }, [key])

  const isFavorite = useCallback(
    (id) => items.some((e) => e.id === id),
    [items],
  )

  // Toggle add/remove for a single event. Returns the FINAL favorite
  // state — `true` when the event is now favorited, `false` when it
  // was just removed. Callers rely on this return value to decide the
  // "Added to favorites" vs "Removed from favorites" toast.
  //
  // Historical bug (fixed here): the previous version assigned the
  // return value inside a setItems(updater) callback and returned it
  // from the outer closure. In React 18 event handlers setState is
  // batched, so the updater runs during reconciliation — AFTER the
  // outer function has already returned its (still-initial) value.
  // Result: state updated correctly but the boolean was always the
  // fallback, and every click showed "Removed from favorites".
  //
  // The fix computes wasFavorite from the current `items` closure
  // synchronously, then dispatches the state update. Return value is
  // decided before the setter runs, not by watching it.
  const toggle = useCallback(
    (event) => {
      if (!key || !event?.id) return false
      const wasFavorite = items.some((e) => e.id === event.id)
      if (wasFavorite) {
        const next = items.filter((e) => e.id !== event.id)
        setItems(next)
        write(key, next)
        return false
      }
      const snapshot = shrink(event)
      if (!snapshot) return wasFavorite // no change → don't mislead the toast
      const next = [snapshot, ...items]
      setItems(next)
      write(key, next)
      return true
    },
    // items MUST be in the dep list — the closure over it is how we
    // deterministically decide add vs remove. FavoriteButton re-renders
    // on every items change anyway, so the extra callback identity
    // churn is free.
    [key, items],
  )

  return {
    favorites: items,
    favoriteCount: items.length,
    isFavorite,
    toggleFavorite: toggle,
    canFavorite: !!user,
  }
}
