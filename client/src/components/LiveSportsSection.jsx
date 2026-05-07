import Section from './Section.jsx'
import EventCard from './EventCard.jsx'
import CardScroller from './CardScroller.jsx'
import { SkeletonCard } from './Skeleton.jsx'
import { useSportsEvents } from '../lib/useSportsEvents.js'

export default function LiveSportsSection({
  title,
  subtitle,
  seeAllHref,
  background,
  league,
  size = 12,
  fallback = [],
}) {
  const { events, loading, isLive } = useSportsEvents(
    { league, size },
    { fallback },
  )

  const cards = events.map((e) => ({
    ...e,
    location: e.venue ? `${e.venue}, ${e.city}` : e.city,
  }))

  return (
    <Section
      title={title}
      subtitle={subtitle}
      seeAllHref={seeAllHref}
      background={background}
    >
      {loading && cards.length === 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <CardScroller>
          {cards.map((event) => (
            <EventCard key={event.id} {...event} />
          ))}
        </CardScroller>
      )}

      {isLive && (
        <p className="mt-3 text-xs text-gray-400">
          Live data from TheSportsDB · synced hourly
        </p>
      )}
    </Section>
  )
}
