import { useEffect, useState } from 'react'

// Module-level cache so the first LeagueCard to mount triggers one fetch
// and every subsequent card on the page reads the cached map.
let cachedCounts = null
let inflight = null
const subscribers = new Set()

function notify(counts) {
  for (const s of subscribers) s(counts)
}

async function fetchOnce() {
  if (cachedCounts) return cachedCounts
  if (inflight) return inflight
  inflight = fetch('/api/sports/counts')
    .then((r) => r.json())
    .then((d) => {
      cachedCounts = d?.counts || {}
      notify(cachedCounts)
      return cachedCounts
    })
    .catch(() => {
      cachedCounts = {}
      notify(cachedCounts)
      return cachedCounts
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/**
 * Returns live league → upcoming-event-count map. Counts come from the
 * SAME backend cache the list endpoint uses, so the number always
 * matches what `/sports/:league` actually renders.
 */
export function useLeagueCounts() {
  const [counts, setCounts] = useState(cachedCounts || {})
  const [loading, setLoading] = useState(!cachedCounts)

  useEffect(() => {
    const onUpdate = (c) => {
      setCounts(c)
      setLoading(false)
    }
    subscribers.add(onUpdate)

    if (cachedCounts) {
      setCounts(cachedCounts)
      setLoading(false)
    } else {
      fetchOnce()
    }

    return () => {
      subscribers.delete(onUpdate)
    }
  }, [])

  return { counts, loading }
}
