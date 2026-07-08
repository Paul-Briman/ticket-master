import Section from './Section.jsx'
import EventCard from './EventCard.jsx'
import CardScroller from './CardScroller.jsx'
import { SkeletonCard } from './Skeleton.jsx'
import { useEventList } from '../lib/useEventList.js'

// Duplicates Home.jsx's sortFeaturedFirst — kept local so the
// component can be dropped anywhere without a Home-specific import.
// Featured events for `sectionKey` rise to the top, sorted by numeric
// featuredOrder ascending; featured items without a numeric order sit
// after ordered ones but before every non-featured event. Non-featured
// events preserve their natural order. When nothing is featured for
// the section, output === input (automatic fallback).
function sortByFeatured(events, sectionKey) {
  if (!Array.isArray(events) || events.length === 0) return events
  const featured = []
  const other = []
  for (const e of events) {
    if (e?.featured === true && e?.featuredSection === sectionKey) {
      featured.push(e)
    } else {
      other.push(e)
    }
  }
  if (featured.length === 0) return events
  featured.sort((a, b) => {
    const ao = Number(a?.featuredOrder)
    const bo = Number(b?.featuredOrder)
    const aHas = Number.isFinite(ao)
    const bHas = Number.isFinite(bo)
    if (aHas && bHas) return ao - bo
    if (aHas) return -1
    if (bHas) return 1
    return 0
  })
  return [...featured, ...other]
}

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
  // When set, admin-featured events for THIS section key rise to the
  // top of the lane, sorted by featuredOrder ascending. Unfeatured
  // events keep the natural order below.
  featuredSectionKey,
}) {
  const { events, loading } = useEventList(category, { size })
  if (hideWhenEmpty && !loading && events.length === 0) return null

  // Apply featured-first ordering if the caller asked for it.
  const ordered = featuredSectionKey
    ? sortByFeatured(events, featuredSectionKey)
    : events
  const cards = ordered.map((e) => ({
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
