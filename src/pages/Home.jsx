import Hero from '../components/Hero.jsx'
import Section from '../components/Section.jsx'
import EventCard from '../components/EventCard.jsx'
import CardScroller from '../components/CardScroller.jsx'
import { CityFeatureCard } from '../components/CityCard.jsx'
import {
  worldCupMatches,
  concerts,
  getEventsByCategory,
} from '../data/events.js'
import { POPULAR_US_CITIES } from '../data/cities.js'

export default function Home() {
  const artsEvents = getEventsByCategory('arts')
  const familyEvents = getEventsByCategory('family')

  return (
    <div className="flex flex-col">
      <Hero />

      <Section
        title="Popular World Cup Matches"
        subtitle="Don\u2019t miss out on the biggest stage in football."
        seeAllHref="/sports"
      >
        <CardScroller>
          {worldCupMatches.map((match) => (
            <EventCard key={match.id} {...match} />
          ))}
        </CardScroller>
      </Section>

      <Section
        title="Trending Concerts"
        subtitle="The hottest tours and performances right now."
        seeAllHref="/concerts"
        background="gray"
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
        background="gray"
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
