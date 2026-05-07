import { CATEGORIES } from '../data/categories.js'
import { SPORTS_LEAGUES } from '../data/leagues.js'
import { getEventsByCategory } from '../data/events.js'
import CategoryHeader from '../components/CategoryHeader.jsx'
import SportsTabs from '../components/sports/SportsTabs.jsx'
import LeagueCard from '../components/sports/LeagueCard.jsx'
import EventGrid from '../components/EventGrid.jsx'
import Section from '../components/Section.jsx'

export default function Sports() {
  const config = CATEGORIES.sports
  const allEvents = getEventsByCategory('sports')
  const featured = [...allEvents]
    .sort((a, b) => {
      const aBadge = a.badge ? 0 : 1
      const bBadge = b.badge ? 0 : 1
      return aBadge - bBadge
    })
    .slice(0, 8)

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
        subtitle={`${allEvents.length} sports events available — handpicked for you.`}
        background="gray"
      >
        <EventGrid
          events={featured.map((e) => ({
            ...e,
            location: e.venue ? `${e.venue}, ${e.city}` : e.city,
          }))}
        />
      </Section>
    </div>
  )
}
