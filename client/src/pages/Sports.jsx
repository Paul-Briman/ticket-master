import { useMemo, useState } from 'react'
import { CATEGORIES } from '../data/categories.js'
import { SPORTS_LEAGUES } from '../data/leagues.js'
import CategoryHeader from '../components/CategoryHeader.jsx'
import SportsTabs from '../components/sports/SportsTabs.jsx'
import LeagueCard from '../components/sports/LeagueCard.jsx'
import EventGrid from '../components/EventGrid.jsx'
import Section from '../components/Section.jsx'
import { SkeletonCard } from '../components/Skeleton.jsx'
import { useAllSportsEvents } from '../lib/useAllSportsEvents.js'
import { filterEvents } from '../lib/search.js'

export default function Sports() {
  const config = CATEGORIES.sports
  // Single source of truth — same per-league cache the LeagueCard
  // counts and the SportsLeague pages read from.
  const { allEvents, counts, loading } = useAllSportsEvents()
  const events = allEvents
  const [query, setQuery] = useState('')

  const decorated = useMemo(
    () =>
      events.map((e) => ({
        ...e,
        location: e.venue ? `${e.venue}, ${e.city}` : e.city,
      })),
    [events],
  )

  const filtered = useMemo(() => filterEvents(decorated, query), [decorated, query])
  const featured = filtered.slice(0, 12)

  return (
    <div className="flex flex-col">
      <CategoryHeader
        title={config.title}
        subtitle={config.subtitle}
        image={config.banner}
      />

      <SportsTabs active="all" />

      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-6">
          <label className="relative block">
            <span className="sr-only">Search sports events</span>
            <span
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              🔍
            </span>
            <input
              type="search"
              inputMode="search"
              placeholder="Search teams, leagues, venues, cities..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </label>
        </div>
      </div>

      <Section
        title="Browse Sports by League"
        subtitle="Tap into the leagues, tours, and tournaments fans care about."
        background="white"
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {SPORTS_LEAGUES.map((league, idx) => (
            <LeagueCard
              key={league.key}
              league={league}
              lock={400 + idx}
              count={counts[league.key]}
              loading={loading}
            />
          ))}
        </div>
      </Section>

      <Section
        title={query ? `Results for “${query}”` : 'Featured Events'}
        subtitle={
          loading
            ? 'Loading upcoming fixtures...'
            : query
              ? `${filtered.length} match${filtered.length === 1 ? '' : 'es'} for “${query}”`
              : `${filtered.length} upcoming sports events.`
        }
        background="gray"
      >
        {loading && featured.length === 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <EventGrid
            events={featured}
            emptyMessage={
              query
                ? `No upcoming sports events match “${query}”.`
                : 'No upcoming sports fixtures right now — check back soon.'
            }
          />
        )}
      </Section>
    </div>
  )
}
