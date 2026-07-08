import Section from './Section.jsx'
import EventCard from './EventCard.jsx'
import CardScroller from './CardScroller.jsx'
import { SkeletonCard } from './Skeleton.jsx'
import { useEventList } from '../lib/useEventList.js'

function EmptyState({ label }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <p className="text-sm font-medium text-gray-700">
        No upcoming {label} available right now.
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Check back soon — the calendar is always being updated.
      </p>
    </div>
  )
}

export default function LiveEventsSection({
  category,
  title,
  subtitle,
  seeAllHref,
  background,
  size = 16,
  emptyLabel,
  // When true, the section renders nothing (no title, no cards, no
  // See All, no spacing) once loading resolves with zero events.
  // Homepage sets this so the layout closes gaps naturally.
  hideWhenEmpty = false,
}) {
  const { events, loading } = useEventList(category, { size })
  if (hideWhenEmpty && !loading && events.length === 0) return null

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
      ) : cards.length === 0 ? (
        <EmptyState label={emptyLabel || (title || category).toLowerCase()} />
      ) : (
        <CardScroller>
          {cards.map((event) => (
            <EventCard key={event.id} {...event} />
          ))}
        </CardScroller>
      )}
    </Section>
  )
}
