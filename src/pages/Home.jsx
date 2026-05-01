import Hero from '../components/Hero.jsx'
import Section from '../components/Section.jsx'
import EventCard from '../components/EventCard.jsx'
import CardScroller from '../components/CardScroller.jsx'
import { worldCupMatches, concerts } from '../data/events.js'

export default function Home() {
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
    </div>
  )
}
