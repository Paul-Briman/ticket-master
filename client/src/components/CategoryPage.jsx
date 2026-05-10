import { useMemo, useState } from 'react'
import CategoryHeader from './CategoryHeader.jsx'
import EventGrid from './EventGrid.jsx'
import { SkeletonCard } from './Skeleton.jsx'
import { CATEGORIES } from '../data/categories.js'
import { useEventList } from '../lib/useEventList.js'
import { filterEvents } from '../lib/search.js'

export default function CategoryPage({ categoryKey }) {
  const config = CATEGORIES[categoryKey]
  const [query, setQuery] = useState('')

  const { events, loading } = useEventList(categoryKey, { size: 50 })

  const filtered = useMemo(() => filterEvents(events, query), [events, query])
  const showSkeleton = loading && events.length === 0

  if (!config) {
    return (
      <div className="container-page py-16 text-center text-gray-500">
        Category not found.
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <CategoryHeader
        title={config.title}
        subtitle={config.subtitle}
        image={config.banner}
      />

      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-6">
          <label className="relative block">
            <span className="sr-only">Search {config.name} events</span>
            <span
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              🔍
            </span>
            <input
              type="search"
              inputMode="search"
              placeholder={`Search ${config.name.toLowerCase()} by title, venue, city...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </label>
        </div>
      </div>

      <section className="bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900 md:text-3xl">
                Upcoming {config.name} Events
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {showSkeleton
                  ? 'Loading events...'
                  : query
                    ? `${filtered.length} match${filtered.length === 1 ? '' : 'es'} for “${query}”`
                    : `${filtered.length} event${filtered.length === 1 ? '' : 's'} available`}
              </p>
            </div>
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-xs font-medium text-brand hover:text-brand-dark"
              >
                Clear search
              </button>
            )}
          </div>

          {showSkeleton ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : filtered.length === 0 && query ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
              <p className="text-base font-semibold text-gray-700">
                No {config.name.toLowerCase()} match “{query}”.
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Try a different artist, venue, or city — or clear the search
                to see everything.
              </p>
            </div>
          ) : (
            <EventGrid
              events={filtered}
              emptyMessage={`No upcoming ${config.name.toLowerCase()} right now — check back soon.`}
            />
          )}
        </div>
      </section>
    </div>
  )
}
