import { formatPrice, optionLabel, SERVICE_FEE_RATE } from '../lib/price.js'
import PromotionBadge, {
  formatPromotionLabel,
} from './PromotionBadge.jsx'
import Image from './Image.jsx'

export default function OrderSummary({ event, option, quantity }) {
  // option.price is ALREADY the promotion-discounted per-ticket
  // price when a promo is active (see getSeatOptions). originalPrice
  // is set in that case so we can compute the per-row savings.
  const perTicket = option?.price || 0
  const subtotal = perTicket * quantity
  const fee = subtotal * SERVICE_FEE_RATE
  const total = subtotal + fee

  const hasPromo = !!(event?.promotion && option?.originalPrice)
  const originalSubtotal = hasPromo ? option.originalPrice * quantity : null
  const savings = hasPromo ? originalSubtotal - subtotal : 0

  return (
    <aside className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="overflow-hidden rounded-t-lg">
        <Image
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
          {event?.promotion && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-blue-100 bg-blue-50/60 px-2.5 py-1.5">
              <PromotionBadge promotion={event.promotion} size="sm" />
              <span className="truncate text-xs font-medium text-gray-700">
                {event.promotion.name}
              </span>
            </div>
          )}
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Section" value={option ? optionLabel(option) : '—'} />
          <Row label="Tier" value={option?.tierLabel || '—'} />
          <Row
            label="Price per ticket"
            value={
              hasPromo ? (
                <span className="inline-flex items-baseline gap-2">
                  <span className="text-gray-400 line-through">
                    {formatPrice(option.originalPrice)}
                  </span>
                  <span className="font-semibold text-brand">
                    {formatPrice(perTicket)}
                  </span>
                </span>
              ) : (
                formatPrice(perTicket)
              )
            }
          />
          <Row label="Quantity" value={`× ${quantity}`} />
        </dl>

        <dl className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
          {hasPromo && (
            <Row
              label="Subtotal before discount"
              value={<span className="line-through">{formatPrice(originalSubtotal)}</span>}
              muted
            />
          )}
          {hasPromo && (
            <Row
              label={`Discount (${formatPromotionLabel(event.promotion)})`}
              value={
                <span className="font-semibold text-emerald-700">
                  −{formatPrice(savings)}
                </span>
              }
            />
          )}
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
