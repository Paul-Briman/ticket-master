import { Link } from 'react-router-dom'

export function CityFeatureCard({ name, slug, eventCount, image }) {
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
        {typeof eventCount === 'number' && (
          <p className="text-sm text-gray-200">{eventCount}+ events</p>
        )}
      </div>
    </Link>
  )
}

export function CityListCard({ name, slug, country }) {
  return (
    <Link
      to={`/city/${slug}`}
      className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm transition-colors hover:border-brand hover:bg-blue-50/40"
    >
      <span className="font-medium text-gray-800 group-hover:text-brand">
        {name}
      </span>
      {country && <span className="text-xs text-gray-500">{country}</span>}
    </Link>
  )
}
