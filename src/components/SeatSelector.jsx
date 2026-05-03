import SeatingMap from './SeatingMap.jsx'
import { formatPrice } from '../lib/price.js'

export default function SeatSelector({
  event,
  tiers,
  selectedKey,
  onSelect,
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 md:p-6">
      <header className="mb-5">
        <h2 className="text-xl font-bold text-gray-900 md:text-2xl">
          Select Your Seats
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Choose a section that fits your style and budget.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[1.1fr_1fr] md:gap-6">
        <div className="flex flex-col">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Seating Map
          </p>
          <div className="flex flex-1 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-3 md:p-4">
            <SeatingMap category={event.category} selectedKey={selectedKey} />
          </div>
          <p className="mt-2 text-center text-xs text-gray-400">
            {event.venue || 'Venue'} ·{' '}
            {event.category === 'concerts'
              ? 'Stage view layout'
              : 'Bowl seating layout'}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {tiers.map((tier) => {
            const selected = selectedKey === tier.key
            return (
              <button
                key={tier.key}
                type="button"
                onClick={() => onSelect(tier.key)}
                className={`group relative flex cursor-pointer items-start justify-between gap-3 rounded-lg border-2 p-4 text-left transition-all duration-150 ${
                  selected
                    ? 'border-brand bg-blue-50/60 shadow-sm'
                    : 'border-gray-200 bg-white hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {tier.name}
                    </span>
                    {tier.badge && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                        {tier.badge}
                      </span>
                    )}
                  </div>
                  <span className="mt-1 line-clamp-2 text-xs text-gray-500">
                    {tier.description}
                  </span>
                  <span
                    className={`mt-2 text-xs font-medium ${
                      selected ? 'text-brand' : 'text-gray-400'
                    }`}
                  >
                    {selected ? '✓ Selected' : 'Tap to select'}
                  </span>
                </div>

                <div className="shrink-0 text-right">
                  <span className="block text-lg font-bold text-brand">
                    {formatPrice(tier.price)}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">
                    per ticket
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
