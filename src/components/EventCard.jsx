import { Link } from 'react-router-dom'

const BADGE_STYLES = {
  hot: 'bg-red-50 text-red-600 border border-red-200',
  limited: 'bg-amber-50 text-amber-700 border border-amber-200',
  new: 'bg-blue-50 text-blue-600 border border-blue-200',
}

export default function EventCard({
  id,
  title,
  date,
  location,
  price,
  image,
  badge,
  badgeType = 'hot',
}) {
  const href = id ? `/event/${id}` : '#'

  return (
    <Link
      to={href}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-all duration-200 hover:-translate-y-1 hover:border-gray-300 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
        {image ? (
          <img
            src={image}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
            No image
          </div>
        )}

        {badge && (
          <span
            className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold ${
              BADGE_STYLES[badgeType] || BADGE_STYLES.hot
            }`}
          >
            {badge}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-base font-bold text-gray-900 group-hover:text-brand">
          {title}
        </h3>

        <div className="flex flex-col gap-0.5 text-sm text-gray-500">
          {date && <span>{date}</span>}
          {location && <span>{location}</span>}
        </div>

        {price && (
          <div className="mt-auto pt-2 text-sm font-semibold text-brand">
            From {price}
          </div>
        )}
      </div>
    </Link>
  )
}
