import { useParams, Link } from 'react-router-dom'
import EventGrid from '../components/EventGrid.jsx'
import { SkeletonCard } from '../components/Skeleton.jsx'
import {
  POPULAR_US_CITIES,
  ALL_US_CITIES,
  WORLDWIDE_CITIES,
} from '../data/cities.js'
import { fromSlug } from '../lib/slug.js'
import { useCityEvents } from '../lib/useCityEvents.js'

function findCityName(slug) {
  const all = [...POPULAR_US_CITIES, ...ALL_US_CITIES, ...WORLDWIDE_CITIES]
  const match = all.find((c) => c.slug === slug)
  return match ? match.name : fromSlug(slug)
}

export default function CityPage() {
  const { name: slug } = useParams()
  const cityName = findCityName(slug)
  const { byCity, loading } = useCityEvents()

  // Same source as the city card on the homepage / cities page, so
  // the count there and the rendered grid here are guaranteed equal.
  const events = (byCity[slug] || []).map((e) => ({
    ...e,
    location: e.venue ? `${e.venue}, ${e.city}` : e.city,
  }))

  const showSkeleton = loading && events.length === 0

  return (
    <div className="flex flex-col">
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
          <Link
            to="/cities"
            className="text-sm font-medium text-brand hover:text-brand-dark"
          >
            ← All cities
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-gray-900 md:text-4xl">
            Events in {cityName}
          </h1>
          <p className="mt-2 text-gray-600">
            Discover events happening in {cityName}.
          </p>
        </div>
      </section>

      <section className="bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-bold text-gray-900 md:text-3xl">
              Upcoming Events
            </h2>
            <span className="text-sm text-gray-500">
              {showSkeleton
                ? 'Loading...'
                : `${events.length} event${events.length === 1 ? '' : 's'}`}
            </span>
          </div>

          {showSkeleton ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (
            <EventGrid
              events={events}
              emptyMessage={`No upcoming events in ${cityName} right now — check back soon.`}
            />
          )}
        </div>
      </section>
    </div>
  )
}
