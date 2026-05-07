import Hero from '../components/Hero.jsx'
import Section from '../components/Section.jsx'
import EventCard from '../components/EventCard.jsx'
import CardScroller from '../components/CardScroller.jsx'
import { CityFeatureCard } from '../components/CityCard.jsx'
import LeagueCard from '../components/sports/LeagueCard.jsx'
import {
  worldCupMatches,
  concerts,
  getEventsByCategory,
  EVENTS,
} from '../data/events.js'
import { POPULAR_US_CITIES } from '../data/cities.js'
import { SPORTS_LEAGUES } from '../data/leagues.js'
import { useRecentlyViewed } from '../lib/recentlyViewed.js'

export default function Home() {
  const artsEvents = getEventsByCategory('arts')
  const familyEvents = getEventsByCategory('family')
  const { recentIds } = useRecentlyViewed()
  const recentEvents = recentIds
    .map((id) => EVENTS.find((e) => e.id === id))
    .filter(Boolean)

  return (
    <div className="flex flex-col">
      <Hero />

      {recentEvents.length > 0 && (
        <Section
          title="Recently Viewed"
          subtitle="Pick up where you left off."
          background="gray"
        >
          <CardScroller>
            {recentEvents.map((event) => (
              <EventCard key={event.id} {...event} />
            ))}
          </CardScroller>
        </Section>
      )}

      <Section
        title="Popular World Cup Matches"
        subtitle="Don't miss out on the biggest stage in football."
        seeAllHref="/sports/world-cup"
      >
        <CardScroller>
          {worldCupMatches.map((match) => (
            <EventCard key={match.id} {...match} />
          ))}
        </CardScroller>
      </Section>

      <Section
        title="Browse Sports by League"
        subtitle="Pick your league — from the World Cup and UCL to the NBA, NFL, F1, UFC, and more."
        seeAllHref="/sports"
        background="gray"
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {SPORTS_LEAGUES.map((league, idx) => (
            <LeagueCard
              key={league.key}
              league={league}
              lock={500 + idx}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Trending Concerts"
        subtitle="The hottest tours and performances right now."
        seeAllHref="/concerts"
      >
        <CardScroller>
          {concerts.map((concert) => (
            <EventCard key={concert.id} {...concert} />
          ))}
        </CardScroller>
      </Section>

      <Section
        title="Arts & Theater"
        subtitle="Discover plays, shows, and live performances."
        seeAllHref="/arts"
        background="gray"
      >
        <CardScroller>
          {artsEvents.map((event) => (
            <EventCard key={event.id} {...event} />
          ))}
        </CardScroller>
      </Section>

      <Section
        title="Family Events"
        subtitle="Fun experiences for all ages."
        seeAllHref="/family"
      >
        <CardScroller>
          {familyEvents.map((event) => (
            <EventCard key={event.id} {...event} />
          ))}
        </CardScroller>
      </Section>

      <Section
        title="Popular Cities"
        subtitle="Find events in top cities across the United States."
        seeAllHref="/cities"
        background="gray"
      >
        <CardScroller>
          {POPULAR_US_CITIES.map((city) => (
            <CityFeatureCard key={city.slug} {...city} />
          ))}
        </CardScroller>
      </Section>
    </div>
  )
}
