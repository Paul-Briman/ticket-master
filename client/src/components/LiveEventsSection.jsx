import { useMemo } from 'react'
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

// Merge admin-featured events into the natural fetch pool per the
// "Feature on Homepage" spec:
//   · Featured events come FIRST, sorted by numeric featuredOrder
//     ascending (unordered entries after ordered ones).
//   · Natural pool comes next, minus any id already present in the
//     featured prefix so an event never appears twice.
//   · Final slice to `size` happens in the render path — H naturally
//     rolls off the tail once a featured entry is prepended.
function mergeFeaturedThenNatural(featured, natural) {
  const naturalArr = Array.isArray(natural) ? natural : []
  if (!Array.isArray(featured) || featured.length === 0) return naturalArr
  const sorted = featured.slice().sort((a, b) => {
    const ao = Number(a?.featuredOrder)
    const bo = Number(b?.featuredOrder)
    const aHas = Number.isFinite(ao)
    const bHas = Number.isFinite(bo)
    if (aHas && bHas) return ao - bo
    if (aHas) return -1
    if (bHas) return 1
    return 0
  })
  const featuredIds = new Set(sorted.map((e) => e?.id).filter(Boolean))
  const deduped = naturalArr.filter((e) => e?.id && !featuredIds.has(e.id))
  return [...sorted, ...deduped]
}

export default function LiveEventsSection({
  category,
  title,
  subtitle,
  seeAllHref,
  background,
  size = 16,
  emptyLabel,
  // Admin-featured events for THIS lane (already scoped by
  // featuredSection at the call site). When non-empty they are
  // prepended to the natural fetch, deduplicated by id, and the
  // final list is capped at `size` — so featuring event X pushes
  // the last natural card off the end rather than replacing the
  // section wholesale. Empty array = pure automatic behavior.
  prependEvents,
  // When true, the section renders nothing (no title, no cards, no
  // See All, no spacing) once loading resolves with zero events.
  // Homepage sets this so the layout closes gaps naturally.
  hideWhenEmpty = false,
}) {
  const { events, loading } = useEventList(category, { size })

  // Merge featured-prepended list, then cap at the configured display
  // limit. Memoized so we don't re-sort on every parent render.
  const merged = useMemo(() => {
    const combined = mergeFeaturedThenNatural(prependEvents, events)
    return combined.slice(0, size)
  }, [prependEvents, events, size])

  if (hideWhenEmpty && !loading && merged.length === 0) return null

  const cards = merged.map((e) => ({
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
