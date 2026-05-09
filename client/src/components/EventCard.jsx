import { Link } from 'react-router-dom'
import FavoriteButton from './FavoriteButton.jsx'

const BADGE_STYLES = {
  hot: 'bg-red-50 text-red-600 border border-red-200',
  limited: 'bg-amber-50 text-amber-700 border border-amber-200',
  new: 'bg-blue-50 text-blue-600 border border-blue-200',
}

function VersusVisual({ homeTeam, awayTeam, homeCrest, awayCrest }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100 p-4">
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex flex-1 flex-col items-center gap-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white p-1 shadow-sm md:h-20 md:w-20">
            {homeCrest ? (
              <img
                src={homeCrest}
                alt={homeTeam || 'Home team'}
                loading="lazy"
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-xs font-semibold text-gray-400">HOME</span>
            )}
          </div>
          {homeTeam && (
            <span className="line-clamp-2 max-w-[100px] text-[11px] font-semibold uppercase tracking-wide text-gray-700">
              {homeTeam}
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center">
          <span className="rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm">
            vs
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center gap-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white p-1 shadow-sm md:h-20 md:w-20">
            {awayCrest ? (
              <img
                src={awayCrest}
                alt={awayTeam || 'Away team'}
                loading="lazy"
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-xs font-semibold text-gray-400">AWAY</span>
            )}
          </div>
          {awayTeam && (
            <span className="line-clamp-2 max-w-[100px] text-[11px] font-semibold uppercase tracking-wide text-gray-700">
              {awayTeam}
            </span>
          )}
        </div>
      </div>
    </div>
  )
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
  homeTeam,
  awayTeam,
  homeCrest,
  awayCrest,
}) {
  const href = id ? `/event/${id}` : '#'
  const hasVersus = !!(homeCrest && awayCrest && homeTeam && awayTeam)

  return (
    <Link
      to={href}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-all duration-200 hover:-translate-y-1 hover:border-gray-300 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
        {id && <FavoriteButton eventId={id} eventTitle={title} />}

        {hasVersus ? (
          <VersusVisual
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            homeCrest={homeCrest}
            awayCrest={awayCrest}
          />
        ) : image ? (
          <img
            src={image}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
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
