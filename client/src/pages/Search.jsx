import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import EventGrid from '../components/EventGrid.jsx'
import { SkeletonCard } from '../components/Skeleton.jsx'
import { useAllSportsEvents } from '../lib/useAllSportsEvents.js'
import { useEventList } from '../lib/useEventList.js'
import { filterEvents } from '../lib/search.js'

const ALL_CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'sports', label: 'Sports' },
  { key: 'concerts', label: 'Concerts' },
  { key: 'arts', label: 'Arts & Theater' },
  { key: 'family', label: 'Family' },
]

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQ = searchParams.get('q') || ''
  const initialCategory = searchParams.get('category') || 'all'

  const [query, setQuery] = useState(initialQ)
  const [category, setCategory] = useState(initialCategory)

  // Pull external URL changes back into local state — handles cases
  // like the navbar submitting a new query while the user is already
  // on /search. Keep the comparison cheap so we don't fight the
  // local-state effect below.
  const urlQ = searchParams.get('q') || ''
  const urlCategory = searchParams.get('category') || 'all'
  useEffect(() => {
    if (urlQ !== query) setQuery(urlQ)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQ])
  useEffect(() => {
    if (urlCategory !== category) setCategory(urlCategory)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCategory])

  // Keep the URL in sync with the active filter so the page is
  // shareable/bookmarkable, but debounce so we don't churn history on
  // every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = new URLSearchParams()
      if (query) next.set('q', query)
      if (category !== 'all') next.set('category', category)
      setSearchParams(next, { replace: true })
    }, 200)
    return () => clearTimeout(handle)
  }, [query, category, setSearchParams])

  // Pull from every category in parallel. The sports source is the
  // unified per-league cache used by Home/Sports/SportsLeague — same
  // events in search results as everywhere else on the site.
  const sports = useAllSportsEvents()
  const concerts = useEventList('concerts', { size: 50 })
  const arts = useEventList('arts', { size: 50 })
  const family = useEventList('family', { size: 50 })

  const allEvents = useMemo(() => {
    const buckets = []
    if (category === 'all' || category === 'sports') buckets.push(sports.allEvents)
    if (category === 'all' || category === 'concerts') buckets.push(concerts.events)
    if (category === 'all' || category === 'arts') buckets.push(arts.events)
    if (category === 'all' || category === 'family') buckets.push(family.events)
    const seen = new Set()
    const out = []
    for (const bucket of buckets) {
      for (const e of bucket || []) {
        if (!e?.id || seen.has(e.id)) continue
        seen.add(e.id)
        out.push(e)
      }
    }
    return out
  }, [
    category,
    sports.allEvents,
    concerts.events,
    arts.events,
    family.events,
  ])

  const filtered = useMemo(() => filterEvents(allEvents, query), [allEvents, query])

  const anyLoading =
    sports.loading || concerts.loading || arts.loading || family.loading
  const stillLoadingFirst = anyLoading && allEvents.length === 0

  return (
    <div className="bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            Search events
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Search across sports, concerts, arts, and family events. Try a
            team, artist, venue, or city.
          </p>

          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-stretch">
            <label className="relative flex-1">
              <span className="sr-only">Search events</span>
              <span
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                🔍
              </span>
              <input
                type="search"
                inputMode="search"
                autoFocus
                placeholder="Search teams, artists, venues, cities..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-3 text-base text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </label>
            <label className="md:w-56">
              <span className="sr-only">Filter category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white py-3 pl-3 pr-9 text-base text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                {ALL_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </header>

      <section>
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-sm text-gray-600">
              {stillLoadingFirst
                ? 'Loading events...'
                : query
                  ? `${filtered.length} result${filtered.length === 1 ? '' : 's'} for `
                  : `${filtered.length} event${filtered.length === 1 ? '' : 's'} available`}
              {query && (
                <span className="font-semibold text-gray-900">“{query}”</span>
              )}
            </p>
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

          {stillLoadingFirst ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
              <p className="text-base font-semibold text-gray-700">
                {query
                  ? `No events match “${query}”.`
                  : 'No events available right now.'}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {query
                  ? 'Try a different team, artist, venue, or city — or clear the search to see everything.'
                  : 'Check back soon — the calendar is always being updated.'}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs text-gray-500">
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="rounded-full border border-gray-200 px-3 py-1 font-medium text-gray-700 hover:border-brand hover:text-brand"
                  >
                    Clear search
                  </button>
                )}
                <Link
                  to="/"
                  className="rounded-full border border-gray-200 px-3 py-1 font-medium text-gray-700 hover:border-brand hover:text-brand"
                >
                  Back to home
                </Link>
              </div>
            </div>
          ) : (
            <EventGrid
              events={filtered.map((e) => ({
                ...e,
                location: e.venue ? `${e.venue}, ${e.city}` : e.city,
              }))}
            />
          )}
        </div>
      </section>
    </div>
  )
}
