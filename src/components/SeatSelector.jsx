import { categoryImg } from '../lib/image.js'
import { formatPrice } from '../lib/price.js'

function venueImage(category, lock = 1) {
  const tags =
    category === 'concerts'
      ? 'concert,stage,venue,lights'
      : category === 'arts'
        ? 'theater,seating,broadway'
        : category === 'family'
          ? 'arena,seating,family'
          : 'stadium,seating,arena'
  return categoryImg(tags, { w: 1200, h: 600, lock: lock + 700 })
}

export default function SeatSelector({
  event,
  tiers,
  selectedKey,
  onSelect,
}) {
  const isConcert = event.category === 'concerts'
  const heading = isConcert ? 'Live Performance Layout' : 'Stadium Layout'

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 md:p-6">
      <header className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 md:text-2xl">
          Select Your Seats
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Choose a section that fits your style and budget.
        </p>
      </header>

      <div className="relative overflow-hidden rounded-lg border border-gray-200">
        <img
          src={venueImage(event.category, parseInt(event.id.replace(/\D/g, '') || '1', 10))}
          alt={`${event.venue || event.title} — ${heading}`}
          className="h-56 w-full object-cover md:h-72"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
        <div className="absolute bottom-3 left-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-90">
            {event.venue || 'Venue'}
          </p>
          <p className="text-sm opacity-90">{heading}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        {tiers.map((tier) => {
          const selected = selectedKey === tier.key
          return (
            <button
              key={tier.key}
              type="button"
              onClick={() => onSelect(tier.key)}
              className={`group relative flex cursor-pointer flex-col rounded-lg border-2 p-4 text-left transition-all duration-150 ${
                selected
                  ? 'border-brand bg-blue-50/60 shadow-sm'
                  : 'border-gray-200 bg-white hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              {tier.badge && (
                <span className="absolute right-3 top-3 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                  {tier.badge}
                </span>
              )}

              <span className="text-sm font-semibold text-gray-900">
                {tier.name}
              </span>
              <span className="mt-1 line-clamp-2 text-xs text-gray-500">
                {tier.description}
              </span>
              <span className="mt-3 text-lg font-bold text-brand">
                {formatPrice(tier.price)}
              </span>

              <span
                className={`mt-2 text-xs font-medium ${
                  selected ? 'text-brand' : 'text-gray-400'
                }`}
              >
                {selected ? '✓ Selected' : 'Tap to select'}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
