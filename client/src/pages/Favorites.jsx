import { Link } from 'react-router-dom'
import EventCard from '../components/EventCard.jsx'
import Button from '../components/Button.jsx'
import { useFavorites } from '../lib/favorites.js'
import { EVENTS } from '../data/events.js'

export default function Favorites() {
  const { favoriteIds, favoriteCount } = useFavorites()
  const events = favoriteIds
    .map((id) => EVENTS.find((e) => e.id === id))
    .filter(Boolean)
    .map((e) => ({
      ...e,
      location: e.venue ? `${e.venue}, ${e.city}` : e.city,
    }))

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            Favorites
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {favoriteCount === 0
              ? 'Save events you love and find them here.'
              : `${favoriteCount} saved event${favoriteCount === 1 ? '' : 's'}.`}
          </p>
        </header>

        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
            <h2 className="text-base font-semibold text-gray-900">
              No favorites yet
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
              Tap the heart on any event to save it here for later.
            </p>
            <Link to="/" className="mt-5 inline-block">
              <Button>Browse events</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {events.map((e) => (
              <EventCard key={e.id} {...e} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
