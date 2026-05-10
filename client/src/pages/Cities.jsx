import Section from '../components/Section.jsx'
import { CityFeatureCard, CityListCard } from '../components/CityCard.jsx'
import {
  POPULAR_US_CITIES,
  ALL_US_CITIES,
  WORLDWIDE_CITIES,
} from '../data/cities.js'
import { useCityEvents } from '../lib/useCityEvents.js'

export default function Cities() {
  const { byCity, loading } = useCityEvents()
  const countFor = (slug) => byCity[slug]?.length ?? 0

  return (
    <div className="flex flex-col">
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
          <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">
            Browse by City
          </h1>
          <p className="mt-2 max-w-2xl text-gray-600">
            Find live events near you — concerts, sports, theater, and family
            shows in cities across the United States and around the world.
          </p>
        </div>
      </section>

      <Section
        title="Popular Cities in the United States"
        subtitle="Top destinations for events on the platform"
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {POPULAR_US_CITIES.map((city) => (
            <CityFeatureCard
              key={city.slug}
              {...city}
              count={countFor(city.slug)}
              loading={loading}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Browse All Cities in the United States"
        subtitle="Alphabetical · primary region of focus"
        background="gray"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {ALL_US_CITIES.map((city) => (
            <CityListCard
              key={city.slug}
              name={city.name}
              slug={city.slug}
              count={countFor(city.slug)}
              loading={loading}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Browse Cities Worldwide"
        subtitle="International destinations with major upcoming events"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {WORLDWIDE_CITIES.map((city) => (
            <CityListCard
              key={city.slug}
              name={city.name}
              slug={city.slug}
              country={city.country}
              count={countFor(city.slug)}
              loading={loading}
            />
          ))}
        </div>
      </Section>
    </div>
  )
}
