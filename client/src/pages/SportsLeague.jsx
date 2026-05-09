import { Navigate, useParams } from 'react-router-dom'
import { findLeague } from '../data/leagues.js'
import SportsTabs from '../components/sports/SportsTabs.jsx'
import LeagueHero from '../components/sports/LeagueHero.jsx'
import FilterBar from '../components/FilterBar.jsx'
import EventGrid from '../components/EventGrid.jsx'
import EventCard from '../components/EventCard.jsx'
import CardScroller from '../components/CardScroller.jsx'
import Section from '../components/Section.jsx'
import { SkeletonCard } from '../components/Skeleton.jsx'
import { useSportsEvents } from '../lib/useSportsEvents.js'

export default function SportsLeague() {
  const { league: leagueKey } = useParams()
  const league = findLeague(leagueKey)

  const { events, loading } = useSportsEvents(
    { league: league?.key, size: 30 },
    { enabled: !!league },
  )

  if (!league) return <Navigate to="/sports" replace />

  const decorated = events.map((e) => ({
    ...e,
    location: e.venue ? `${e.venue}, ${e.city}` : e.city,
  }))
  const featured = decorated.slice(0, 6)

  return (
    <div className="flex flex-col">
      <LeagueHero league={league} />
      <SportsTabs active={league.key} />
      <FilterBar />

      {featured.length > 0 && (
        <Section
          title={`Featured ${league.short} Events`}
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
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
              All {league.short} Events
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {loading
                ? 'Loading upcoming fixtures...'
                : `${decorated.length} event${decorated.length === 1 ? '' : 's'} available`}
            </p>
          </div>

          {loading && decorated.length === 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (
            <EventGrid
              events={decorated}
              emptyMessage={`No upcoming ${league.short} events scheduled — check back soon.`}
            />
          )}
        </div>
      </section>
    </div>
  )
}
