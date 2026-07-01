import Section from './Section.jsx'
import EventCard from './EventCard.jsx'
import CardScroller from './CardScroller.jsx'
import { SkeletonCard } from './Skeleton.jsx'

function EmptyState({ message }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <p className="text-sm font-medium text-gray-700">{message}</p>
      <p className="mt-1 text-xs text-gray-500">Check back soon for new fixtures.</p>
    </div>
  )
}

/**
 * Display a sports lane on Home or any landing page. Receives a
 * pre-fetched events array — never fetches its own data — so this
 * lane and the league page it links to are always derived from the
 * same single-source-of-truth cache (useAllSportsEvents).
 */
export default function LiveSportsSection({
  title,
  subtitle,
  seeAllHref,
  background,
  events = [],
  loading = false,
  displaySize = 12,
  // When true, the section renders nothing (no title, no cards, no
  // See All, no spacing) once loading resolves with zero events.
  // Homepage sets this so the layout closes gaps naturally.
  hideWhenEmpty = false,
}) {
  const cards = events.slice(0, displaySize).map((e) => ({
    ...e,
    location: e.venue ? `${e.venue}, ${e.city}` : e.city,
  }))

  if (hideWhenEmpty && !loading && cards.length === 0) return null

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
        <EmptyState message={`No upcoming ${title.toLowerCase()} fixtures available.`} />
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
