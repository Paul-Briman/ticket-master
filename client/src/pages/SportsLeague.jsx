import { Navigate, useParams } from 'react-router-dom'
import { findLeague } from '../data/leagues.js'
import { getEventsByLeague } from '../data/events.js'
import SportsTabs from '../components/sports/SportsTabs.jsx'
import LeagueHero from '../components/sports/LeagueHero.jsx'
import FilterBar from '../components/FilterBar.jsx'
import EventGrid from '../components/EventGrid.jsx'
import EventCard from '../components/EventCard.jsx'
import CardScroller from '../components/CardScroller.jsx'
import Section from '../components/Section.jsx'

export default function SportsLeague() {
  const { league: leagueKey } = useParams()
  const league = findLeague(leagueKey)
  if (!league) return <Navigate to="/sports" replace />

  const events = getEventsByLeague(league.key).map((e) => ({
    ...e,
    location: e.venue ? `${e.venue}, ${e.city}` : e.city,
  }))
  const featured = events.filter((e) => e.badge).slice(0, 6)

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
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
                All {league.short} Events
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {events.length} event{events.length === 1 ? '' : 's'} available
                · United States
              </p>
            </div>
          </div>

          <EventGrid
            events={events}
            emptyMessage={`No ${league.short} events listed yet — check back soon.`}
          />
        </div>
      </section>
    </div>
  )
}
