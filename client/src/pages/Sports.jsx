import { CATEGORIES } from '../data/categories.js'
import { SPORTS_LEAGUES } from '../data/leagues.js'
import CategoryHeader from '../components/CategoryHeader.jsx'
import SportsTabs from '../components/sports/SportsTabs.jsx'
import LeagueCard from '../components/sports/LeagueCard.jsx'
import EventGrid from '../components/EventGrid.jsx'
import Section from '../components/Section.jsx'
import { SkeletonCard } from '../components/Skeleton.jsx'
import { useSportsEvents } from '../lib/useSportsEvents.js'

export default function Sports() {
  const config = CATEGORIES.sports
  const { events, loading } = useSportsEvents({ size: 24 })

  const featured = [...events]
    .slice(0, 8)
    .map((e) => ({
      ...e,
      location: e.venue ? `${e.venue}, ${e.city}` : e.city,
    }))

  return (
    <div className="flex flex-col">
      <CategoryHeader
        title={config.title}
        subtitle={config.subtitle}
        image={config.banner}
      />

      <SportsTabs active="all" />

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
            />
          ))}
        </div>
      </Section>

      <Section
        title="Featured Events"
        subtitle={
          loading
            ? 'Loading upcoming fixtures...'
            : `${events.length} upcoming sports events.`
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
            emptyMessage="No upcoming sports fixtures right now — check back soon."
          />
        )}
      </Section>
    </div>
  )
}
