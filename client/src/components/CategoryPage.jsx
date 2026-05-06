import CategoryHeader from './CategoryHeader.jsx'
import FilterBar from './FilterBar.jsx'
import EventGrid from './EventGrid.jsx'
import { CATEGORIES } from '../data/categories.js'
import { getEventsByCategory } from '../data/events.js'

export default function CategoryPage({ categoryKey }) {
  const config = CATEGORIES[categoryKey]
  const events = getEventsByCategory(categoryKey)

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
      <FilterBar />

      <section className="bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
                Upcoming {config.name} Events
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {events.length} events available · United States
              </p>
            </div>
          </div>

          <EventGrid events={events} />
        </div>
      </section>
    </div>
  )
}
