import { useCallback, useEffect, useState } from 'react'

const KEY = 'tm_recently_viewed'
const MAX = 12

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function recordRecentView(eventId) {
  if (!eventId) return
  const list = read().filter((id) => id !== eventId)
  list.unshift(eventId)
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
}

export function useRecentlyViewed() {
  const [ids, setIds] = useState([])

  useEffect(() => {
    setIds(read())
    function onStorage(e) {
      if (e.key === KEY) setIds(read())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const refresh = useCallback(() => setIds(read()), [])
  return { recentIds: ids, refresh }
}
