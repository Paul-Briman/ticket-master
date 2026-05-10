import { useMemo } from 'react'
import { useSportsEvents } from './useSportsEvents.js'
import { useEventList } from './useEventList.js'
import { groupEventsByCity } from './groupByCity.js'

// Pull from every category's existing list cache. The underlying hooks
// already memoize per-key, so multiple consumers across the app share
// one network round-trip per category. We never add a new endpoint —
// these are the same lists the home page and category pages render.

export { groupEventsByCity }

/**
 * Hook wrapper around groupEventsByCity. Counts derived from this map
 * are guaranteed to match what each city page renders, because the
 * page uses the same map for its grid.
 *
 * `includeSports` defaults to false. Pages that show a CITY-FACING list
 * of cards (Cities, CityPage) opt in to a full sports aggregation so
 * counts include matches. The home page intentionally opts out — its
 * Popular Cities scroller is a small lane, and triggering an aggregate
 * `/api/sports?size=100` from every home render fans out to all 9
 * leagues simultaneously and risks the very rate-limit / cache-poison
 * cascade that briefly broke the World Cup section.
 */
export function useCityEvents({ includeSports = false } = {}) {
  const sports = useSportsEvents(
    { size: 100 },
    { enabled: includeSports },
  )
  const concerts = useEventList('concerts', { size: 100 })
  const arts = useEventList('arts', { size: 100 })
  const family = useEventList('family', { size: 100 })

  const result = useMemo(
    () =>
      groupEventsByCity(
        sports.events,
        concerts.events,
        arts.events,
        family.events,
      ),
    [sports.events, concerts.events, arts.events, family.events],
  )

  const loading =
    (includeSports && sports.loading && sports.events.length === 0) ||
    (concerts.loading && concerts.events.length === 0) ||
    (arts.loading && arts.events.length === 0) ||
    (family.loading && family.events.length === 0)

  return { ...result, loading }
}
