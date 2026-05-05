import SeatingMap from './SeatingMap.jsx'
import {
  availabilityColors,
  formatPrice,
  optionLabel,
} from '../lib/price.js'

const TIER_PILL = {
  vip: 'bg-blue-600 text-white',
  premium: 'bg-blue-100 text-blue-700',
  standard: 'bg-gray-100 text-gray-700',
  'front-row': 'bg-blue-600 text-white',
  floor: 'bg-blue-100 text-blue-700',
  ga: 'bg-gray-100 text-gray-700',
}

export default function SeatSelector({
  event,
  options,
  selectedKey,
  onSelect,
}) {
  const selected = options.find((o) => o.key === selectedKey)
  const mapTier = selected?.tier ?? null

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 md:p-6">
      <header className="mb-5">
        <h2 className="text-xl font-bold text-gray-900 md:text-2xl">
          Select Your Seats
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Pick a section and row that fits your style and budget.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_1.05fr] md:gap-6">
        <div className="flex flex-col">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Seating Map
          </p>
          <div className="flex flex-1 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-3 md:p-4">
            <SeatingMap category={event.category} selectedKey={mapTier} />
          </div>
          <p className="mt-2 text-center text-xs text-gray-400">
            {event.venue || 'Venue'} ·{' '}
            {event.category === 'concerts'
              ? 'Stage view layout'
              : 'Bowl seating layout'}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Available Sections ({options.length})
          </p>
          <ul className="flex flex-col gap-2">
            {options.map((opt) => (
              <li key={opt.key}>
                <OptionRow
                  option={opt}
                  selected={opt.key === selectedKey}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function OptionRow({ option, selected, onSelect }) {
  const colors = availabilityColors(option.availabilityPercent)
  const filled = 100 - option.availabilityPercent

  return (
    <button
      type="button"
      onClick={() => onSelect(option.key)}
      className={`flex w-full items-center justify-between gap-3 rounded-lg border-2 p-3 text-left transition-all duration-150 ${
        selected
          ? 'border-brand bg-blue-50/60 shadow-sm'
          : 'border-gray-200 bg-white hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-gray-900">
            {optionLabel(option)}
          </span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              TIER_PILL[option.tier] || TIER_PILL.standard
            }`}
          >
            {option.tierLabel}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all duration-300 ${colors.fill}`}
              style={{ width: `${filled}%` }}
            />
          </div>
          <span className={`shrink-0 text-xs font-semibold ${colors.text}`}>
            {option.availabilityPercent}% remaining
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
          <span className={`font-medium ${colors.text}`}>
            {option.availabilityLabel}
          </span>
          {option.urgency && (
            <>
              <span className="text-gray-300">·</span>
              <span className="font-semibold text-red-600">
                {option.urgency}
              </span>
            </>
          )}
          {selected && (
            <span className="ml-auto text-xs font-semibold text-brand">
              ✓ Selected
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <span className="block text-base font-bold text-brand">
          {formatPrice(option.price)}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-gray-400">
          per ticket
        </span>
      </div>
    </button>
  )
}
