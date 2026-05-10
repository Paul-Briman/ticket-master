import { Link } from 'react-router-dom'

/**
 * Render a city teaser card. The `count` prop is the count of upcoming
 * events the platform actually has for this city — derived from the
 * same event cache the city page reads, so the number always matches
 * what the user will see when they click in.
 *
 * Pass `loading` to render a muted state while underlying lists are
 * still resolving. Pass `count={null}` to suppress any count line
 * (used in places where a count is irrelevant).
 */
export function CityFeatureCard({ name, slug, count, loading = false, image }) {
  let label = null
  if (loading && (count === null || count === undefined)) {
    label = 'Loading events...'
  } else if (count === 0) {
    label = 'No upcoming events'
  } else if (typeof count === 'number') {
    label = `${count} upcoming event${count === 1 ? '' : 's'}`
  }

  return (
    <Link
      to={`/city/${slug}`}
      className="group relative block overflow-hidden rounded-lg border border-gray-200 bg-white transition-all duration-200 hover:-translate-y-1 hover:border-gray-300 hover:shadow-md"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
        <img
          src={image}
          alt={name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
        <h3 className="text-lg font-bold">{name}</h3>
        {label && <p className="text-sm text-gray-200">{label}</p>}
      </div>
    </Link>
  )
}

export function CityListCard({ name, slug, country, count, loading = false }) {
  let trailing = null
  if (loading && (count === null || count === undefined)) {
    trailing = <span className="text-xs text-gray-400">…</span>
  } else if (count === 0) {
    trailing = <span className="text-xs text-gray-400">No events</span>
  } else if (typeof count === 'number') {
    trailing = (
      <span className="text-xs font-medium text-gray-500">
        {count} event{count === 1 ? '' : 's'}
      </span>
    )
  } else if (country) {
    trailing = <span className="text-xs text-gray-500">{country}</span>
  }

  return (
    <Link
      to={`/city/${slug}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm transition-colors hover:border-brand hover:bg-blue-50/40"
    >
      <span className="truncate font-medium text-gray-800 group-hover:text-brand">
        {name}
      </span>
      {trailing}
    </Link>
  )
}
