import Hero from '../components/Hero.jsx'
import Section from '../components/Section.jsx'
import EventCard from '../components/EventCard.jsx'
import CardScroller from '../components/CardScroller.jsx'
import LiveSportsSection from '../components/LiveSportsSection.jsx'
import LiveEventsSection from '../components/LiveEventsSection.jsx'
import { CityFeatureCard } from '../components/CityCard.jsx'
import LeagueCard from '../components/sports/LeagueCard.jsx'
import { POPULAR_US_CITIES } from '../data/cities.js'
import { SPORTS_LEAGUES } from '../data/leagues.js'
import { useRecentlyViewed } from '../lib/recentlyViewed.js'
import { useCityEvents } from '../lib/useCityEvents.js'

export default function Home() {
  const { recent } = useRecentlyViewed()
  const recentEvents = recent
  const { byCity, loading: citiesLoading } = useCityEvents()

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

      {/* Anchor target for the Hero "Browse Matches" CTA. The
          scroll-margin-top accounts for the sticky navbar height so
          smooth-scroll lands the heading just under the header. */}
      <div id="matches-section" className="scroll-mt-24 md:scroll-mt-28" />
      <LiveSportsSection
        title="Popular World Cup Matches"
        subtitle="Upcoming FIFA World Cup fixtures."
        seeAllHref="/sports/world-cup"
        league="world-cup"
        size={12}
      />

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

      <LiveEventsSection
        category="concerts"
        title="Trending Concerts"
        subtitle="Upcoming tour dates from artists fans are following most."
        seeAllHref="/concerts"
        size={16}
      />

      <LiveEventsSection
        category="arts"
        title="Arts & Theater"
        subtitle="Broadway productions, comedy nights, opera, and live performances."
        seeAllHref="/arts"
        background="gray"
        size={12}
      />

      <LiveEventsSection
        category="family"
        title="Family Events"
        subtitle="Disney-style experiences, ice shows, circus, and holiday attractions."
        seeAllHref="/family"
        size={12}
      />

      <Section
        title="Popular Cities"
        subtitle="Find events in top cities across the United States."
        seeAllHref="/cities"
        background="gray"
      >
        <CardScroller>
          {POPULAR_US_CITIES.map((city) => (
            <CityFeatureCard
              key={city.slug}
              {...city}
              count={byCity[city.slug]?.length ?? 0}
              loading={citiesLoading}
            />
          ))}
        </CardScroller>
      </Section>
    </div>
  )
}
