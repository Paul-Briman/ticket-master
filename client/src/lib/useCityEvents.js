import { useMemo } from 'react'
import { useAllSportsEvents } from './useAllSportsEvents.js'
import { useEventList } from './useEventList.js'
import { groupEventsByCity } from './groupByCity.js'

export { groupEventsByCity }

/**
 * Hook wrapper around groupEventsByCity. Counts derived from this map
 * are guaranteed to match what each city page renders, because the
 * page uses the same map for its grid.
 *
 * `includeSports` defaults to true. Sports events come from the
 * unified per-league cache (useAllSportsEvents), so a city count and
 * the city page's grid stay aligned with whatever the sports landing,
 * league pages, and search are already showing — single source of
 * truth across the whole platform.
 */
export function useCityEvents({ includeSports = true } = {}) {
  const sports = useAllSportsEvents()
  const concerts = useEventList('concerts', { size: 100 })
  const arts = useEventList('arts', { size: 100 })
  const family = useEventList('family', { size: 100 })

  const sportsEvents = includeSports ? sports.allEvents : []

  const result = useMemo(
    () =>
      groupEventsByCity(
        sportsEvents,
        concerts.events,
        arts.events,
        family.events,
      ),
    [sportsEvents, concerts.events, arts.events, family.events],
  )

  const loading =
    (includeSports && sports.loading && sports.allEvents.length === 0) ||
    (concerts.loading && concerts.events.length === 0) ||
    (arts.loading && arts.events.length === 0) ||
    (family.loading && family.events.length === 0)

  return { ...result, loading }
}
