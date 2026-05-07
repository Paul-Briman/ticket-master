import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './auth.jsx'

const KEY_PREFIX = 'tm_favorites:'

function read(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function write(key, ids) {
  localStorage.setItem(key, JSON.stringify(ids))
}

export function useFavorites() {
  const { user } = useAuth()
  const key = user ? `${KEY_PREFIX}${user.email.toLowerCase()}` : null
  const [ids, setIds] = useState([])

  useEffect(() => {
    if (!key) {
      setIds([])
      return
    }
    setIds(read(key))
  }, [key])

  const isFavorite = useCallback((id) => ids.includes(id), [ids])

  const toggle = useCallback(
    (id) => {
      if (!key) return false
      let added = false
      setIds((prev) => {
        const has = prev.includes(id)
        added = !has
        const next = has ? prev.filter((x) => x !== id) : [id, ...prev]
        write(key, next)
        return next
      })
      return added
    },
    [key],
  )

  return {
    favoriteIds: ids,
    favoriteCount: ids.length,
    isFavorite,
    toggleFavorite: toggle,
    canFavorite: !!user,
  }
}
