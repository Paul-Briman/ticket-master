import { formatPrice, optionLabel, SERVICE_FEE_RATE } from '../lib/price.js'

export default function OrderSummary({ event, option, quantity }) {
  const subtotal = (option?.price || 0) * quantity
  const fee = subtotal * SERVICE_FEE_RATE
  const total = subtotal + fee

  return (
    <aside className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="overflow-hidden rounded-t-lg">
        <img
          src={event.image}
          alt={event.title}
          className="h-32 w-full object-cover"
        />
      </div>

      <div className="p-5 md:p-6">
        <h3 className="text-base font-bold text-gray-900">Order Summary</h3>

        <div className="mt-4 border-b border-gray-100 pb-4">
          <p className="text-sm font-semibold text-gray-900">{event.title}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {event.date} · {event.venue || event.city}
          </p>
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Section" value={option ? optionLabel(option) : '—'} />
          <Row label="Tier" value={option?.tierLabel || '—'} />
          <Row label="Price per ticket" value={formatPrice(option?.price || 0)} />
          <Row label="Quantity" value={`× ${quantity}`} />
        </dl>

        <dl className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
          <Row label="Subtotal" value={formatPrice(subtotal)} muted />
          <Row label="Service fee" value={formatPrice(fee)} muted />
        </dl>

        <div className="mt-4 flex items-baseline justify-between border-t border-gray-100 pt-4">
          <span className="text-sm font-semibold text-gray-700">Total</span>
          <span className="text-2xl font-bold text-brand">
            {formatPrice(total)}
          </span>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          Tickets delivered via mobile · 100% verified
        </p>
      </div>
    </aside>
  )
}

function Row({ label, value, muted }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${
        muted ? 'text-gray-500' : 'text-gray-700'
      }`}
    >
      <dt className="shrink-0">{label}</dt>
      <dd className="truncate text-right font-medium">{value}</dd>
    </div>
  )
}
