import { useMemo } from 'react'
import { useSportsEvents } from './useSportsEvents.js'

// One backend call per league, sharing the existing useSportsEvents
// memory cache so every consumer sees the same array. Each league
// asks for SIZE so different consumers (Home WC lane @12, league
// page @full) hit the same cache key — they slice the result locally.
//
// The list of leagues mirrors lib/routes/sports.js#PROVIDER_FOR_LEAGUE
// and lib/data/leagues.js. If a new league is added, both this hook
// and the data file must include it.
const LEAGUE_KEYS = [
  'world-cup',
  'ucl',
  'nba',
  'nfl',
  'f1',
  'ufc',
  'tennis',
  'mlb',
  'boxing',
]

const SIZE = 50

/**
 * Single source of truth for sports event lists across the platform.
 *
 * Returns:
 *   - byLeague: Record<leagueKey, Event[]>
 *   - counts:   Record<leagueKey, number>   (.length of byLeague[k])
 *   - allEvents: Event[]                    (deduped union across leagues)
 *   - loading:  boolean                     (any underlying league still loading first response)
 *
 * Every section that previously fetched its own slice — Home Popular
 * World Cup Matches, Sports landing, SportsLeague page, Search, the
 * LeagueCard count badge — must derive its data from THIS hook so the
 * count on a card and the events shown on the page can never disagree.
 */
export function useAllSportsEvents() {
  // 9 hooks called in fixed order — never conditional, hooks rule safe.
  const wc = useSportsEvents({ league: 'world-cup', size: SIZE })
  const ucl = useSportsEvents({ league: 'ucl', size: SIZE })
  const nba = useSportsEvents({ league: 'nba', size: SIZE })
  const nfl = useSportsEvents({ league: 'nfl', size: SIZE })
  const f1 = useSportsEvents({ league: 'f1', size: SIZE })
  const ufc = useSportsEvents({ league: 'ufc', size: SIZE })
  const tennis = useSportsEvents({ league: 'tennis', size: SIZE })
  const mlb = useSportsEvents({ league: 'mlb', size: SIZE })
  const boxing = useSportsEvents({ league: 'boxing', size: SIZE })

  const byLeague = useMemo(
    () => ({
      'world-cup': wc.events,
      ucl: ucl.events,
      nba: nba.events,
      nfl: nfl.events,
      f1: f1.events,
      ufc: ufc.events,
      tennis: tennis.events,
      mlb: mlb.events,
      boxing: boxing.events,
    }),
    [
      wc.events,
      ucl.events,
      nba.events,
      nfl.events,
      f1.events,
      ufc.events,
      tennis.events,
      mlb.events,
      boxing.events,
    ],
  )

  const counts = useMemo(() => {
    const out = {}
    for (const k of LEAGUE_KEYS) {
      out[k] = byLeague[k]?.length ?? 0
    }
    return out
  }, [byLeague])

  const allEvents = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const k of LEAGUE_KEYS) {
      for (const e of byLeague[k] || []) {
        if (!e?.id || seen.has(e.id)) continue
        seen.add(e.id)
        out.push(e)
      }
    }
    return out
  }, [byLeague])

  const anyLoading =
    wc.loading ||
    ucl.loading ||
    nba.loading ||
    nfl.loading ||
    f1.loading ||
    ufc.loading ||
    tennis.loading ||
    mlb.loading ||
    boxing.loading
  const anyEvents =
    wc.events.length +
    ucl.events.length +
    nba.events.length +
    nfl.events.length +
    f1.events.length +
    ufc.events.length +
    tennis.events.length +
    mlb.events.length +
    boxing.events.length
  // Loading state should clear once we have anything to show — the rest
  // continues fetching in the background without holding the UI hostage.
  const loading = anyLoading && anyEvents === 0

  return { byLeague, counts, allEvents, loading }
}

export { LEAGUE_KEYS, SIZE as ALL_SPORTS_FETCH_SIZE }
