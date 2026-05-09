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

  const toggle = useCallback(
    (event) => {
      if (!key || !event?.id) return false
      let added = false
      setItems((prev) => {
        const idx = prev.findIndex((e) => e.id === event.id)
        let next
        if (idx >= 0) {
          next = prev.filter((e) => e.id !== event.id)
          added = false
        } else {
          const snapshot = shrink(event)
          if (!snapshot) return prev
          next = [snapshot, ...prev]
          added = true
        }
        write(key, next)
        return next
      })
      return added
    },
    [key],
  )

  return {
    favorites: items,
    favoriteCount: items.length,
    isFavorite,
    toggleFavorite: toggle,
    canFavorite: !!user,
  }
}
