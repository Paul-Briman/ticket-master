import { useCallback, useEffect, useState } from 'react'
import { isEventVisible } from './eventExpiry.js'

const KEY = 'tm_recently_viewed'
const MAX = 12

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

export function recordRecentView(event) {
  if (!event?.id) return
  const snapshot = shrink(event)
  if (!snapshot) return
  const list = read().filter((e) => e.id !== snapshot.id)
  list.unshift(snapshot)
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
}

export function useRecentlyViewed() {
  const [items, setItems] = useState([])

  useEffect(() => {
    setItems(read())
    function onStorage(e) {
      if (e.key === KEY) setItems(read())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const refresh = useCallback(() => setItems(read()), [])
  return { recent: items, refresh }
}
