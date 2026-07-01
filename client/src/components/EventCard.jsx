import { Link } from 'react-router-dom'
import FavoriteButton from './FavoriteButton.jsx'
import Image from './Image.jsx'

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
              <Image
                src={homeCrest}
                alt={homeTeam || 'Home team'}
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
              <Image
                src={awayCrest}
                alt={awayTeam || 'Away team'}
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

export default function EventCard(props) {
  const {
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
    pricing,
    promotion,
  } = props
  const href = id ? `/event/${id}` : '#'
  const hasVersus = !!(homeCrest && awayCrest && homeTeam && awayTeam)
  // When the backend decorated this event with a promotion, derive the
  // original "from" price from event.pricing so the strikethrough shows
  // a real number alongside the (already-discounted) `price` string.
  const originalFromText = promotion ? computeFromText(pricing) : null

  return (
    <Link
      to={href}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-all duration-200 hover:-translate-y-1 hover:border-gray-300 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
        {id && <FavoriteButton event={props} />}

        {hasVersus ? (
          <VersusVisual
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            homeCrest={homeCrest}
            awayCrest={awayCrest}
          />
        ) : image ? (
          <Image
            src={image}
            alt={title}
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

        {promotion && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-red-500 to-pink-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
            {formatPromoLabel(promotion)}
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
          <div className="mt-auto flex items-baseline gap-2 pt-2 text-sm">
            {promotion && originalFromText && (
              <span className="text-gray-400 line-through">{originalFromText}</span>
            )}
            <span className="font-semibold text-brand">From {price}</span>
          </div>
        )}
      </div>
    </Link>
  )
}

// Tiny local helpers — duplicating the label format here avoids
// importing PromotionBadge into every card render (perf) and keeps
// the card self-contained.
function formatPromoLabel(promotion) {
  if (!promotion) return ''
  if (promotion.discountType === 'percentage') return `${Math.round(promotion.discountValue)}% OFF`
  if (promotion.discountType === 'fixed') return `$${Math.round(promotion.discountValue)} OFF`
  return 'SALE'
}

function computeFromText(pricing) {
  if (!pricing) return null
  const values = Object.values(pricing).filter(
    (v) => typeof v === 'number' && Number.isFinite(v) && v > 0,
  )
  if (values.length === 0) return null
  return `$${Math.min(...values).toFixed(0)}`
}
