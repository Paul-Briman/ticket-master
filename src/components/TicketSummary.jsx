import { Link } from 'react-router-dom'
import Button from './Button.jsx'
import { formatPrice, SERVICE_FEE_RATE } from '../lib/price.js'

export default function TicketSummary({
  event,
  tier,
  quantity,
  onQuantityChange,
}) {
  const subtotal = (tier?.price || 0) * quantity
  const fee = subtotal * SERVICE_FEE_RATE
  const total = subtotal + fee

  return (
    <aside className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm md:p-6">
      <h3 className="text-lg font-bold text-gray-900">Ticket Summary</h3>

      <div className="mt-4 border-b border-gray-100 pb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Event
        </p>
        <p className="mt-1 text-sm font-semibold text-gray-900">
          {event.title}
        </p>
        <p className="text-xs text-gray-500">
          {event.date} · {event.venue || event.city}
        </p>
      </div>

      <div className="mt-4 border-b border-gray-100 pb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Selected Section
        </p>
        <p className="mt-1 text-sm font-semibold text-gray-900">
          {tier ? tier.name : 'No section selected'}
        </p>
        {tier && (
          <p className="text-xs text-gray-500">
            {formatPrice(tier.price)} per ticket
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <label
          htmlFor="ticket-qty"
          className="text-sm font-medium text-gray-700"
        >
          Quantity
        </label>
        <select
          id="ticket-qty"
          value={quantity}
          onChange={(e) => onQuantityChange(Number(e.target.value))}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <dl className="mt-5 space-y-2 border-t border-gray-100 pt-4 text-sm">
        <div className="flex justify-between text-gray-600">
          <dt>Subtotal</dt>
          <dd>{formatPrice(subtotal)}</dd>
        </div>
        <div className="flex justify-between text-gray-600">
          <dt>Service fee</dt>
          <dd>{formatPrice(fee)}</dd>
        </div>
        <div className="flex justify-between border-t border-gray-100 pt-3 text-base font-bold text-gray-900">
          <dt>Total</dt>
          <dd>{formatPrice(total)}</dd>
        </div>
      </dl>

      <Link
        to="/checkout"
        state={
          tier
            ? { eventId: event.id, tierKey: tier.key, quantity }
            : null
        }
        className="mt-5 block"
        onClick={(e) => {
          if (!tier) e.preventDefault()
        }}
      >
        <Button className="w-full" size="lg" disabled={!tier}>
          {tier ? 'Proceed to Checkout' : 'Select a section'}
        </Button>
      </Link>

      <p className="mt-3 text-center text-xs text-gray-400">
        Secure checkout · Mobile tickets · Verified resale
      </p>
    </aside>
  )
}
