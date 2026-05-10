import { useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { findLeague } from '../data/leagues.js'
import SportsTabs from '../components/sports/SportsTabs.jsx'
import LeagueHero from '../components/sports/LeagueHero.jsx'
import EventGrid from '../components/EventGrid.jsx'
import EventCard from '../components/EventCard.jsx'
import CardScroller from '../components/CardScroller.jsx'
import Section from '../components/Section.jsx'
import { SkeletonCard } from '../components/Skeleton.jsx'
import { useSportsEvents } from '../lib/useSportsEvents.js'
import { filterEvents } from '../lib/search.js'

export default function SportsLeague() {
  const { league: leagueKey } = useParams()
  const league = findLeague(leagueKey)
  const [query, setQuery] = useState('')

  const { events, loading } = useSportsEvents(
    { league: league?.key, size: 120 },
    { enabled: !!league },
  )

  const decorated = useMemo(
    () =>
      events.map((e) => ({
        ...e,
        location: e.venue ? `${e.venue}, ${e.city}` : e.city,
      })),
    [events],
  )
  const filtered = useMemo(() => filterEvents(decorated, query), [decorated, query])
  const featured = filtered.slice(0, 6)

  if (!league) return <Navigate to="/sports" replace />

  return (
    <div className="flex flex-col">
      <LeagueHero league={league} />
      <SportsTabs active={league.key} />

      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-6">
          <label className="relative block">
            <span className="sr-only">Search {league.short} events</span>
            <span
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              🔍
            </span>
            <input
              type="search"
              inputMode="search"
              placeholder={`Search ${league.short} teams, venues, cities...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </label>
        </div>
      </div>

      {featured.length > 0 && (
        <Section
          title={query ? `Top results for “${query}”` : `Featured ${league.short} Events`}
          subtitle={league.description}
          background="white"
        >
          <CardScroller>
            {featured.map((event) => (
              <EventCard key={event.id} {...event} />
            ))}
          </CardScroller>
        </Section>
      )}

      <section className="bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900 md:text-3xl">
                All {league.short} Events
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {loading
                  ? 'Loading upcoming fixtures...'
                  : query
                    ? `${filtered.length} match${filtered.length === 1 ? '' : 'es'} for “${query}”`
                    : `${filtered.length} event${filtered.length === 1 ? '' : 's'} available`}
              </p>
            </div>
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-xs font-medium text-brand hover:text-brand-dark"
              >
                Clear search
              </button>
            )}
          </div>

          {loading && filtered.length === 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (
            <EventGrid
              events={filtered}
              emptyMessage={
                query
                  ? `No ${league.short} events match “${query}”.`
                  : `No upcoming ${league.short} events scheduled — check back soon.`
              }
            />
          )}
        </div>
      </section>
    </div>
  )
}
