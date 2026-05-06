import { formatPrice, optionLabel } from '../lib/price.js'

export default function TicketEmail({ order }) {
  if (!order) return null

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(
    order.id,
  )}`

  return (
    <div className="bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-md overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="bg-brand px-6 py-5 text-center">
          <span className="inline-block rounded-md bg-white/15 px-3 py-1 text-lg font-bold italic text-white">
            ticketmaster<sup className="text-[0.55em]">®</sup>
          </span>
        </div>

        <div className="border-b border-gray-100 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">
            Tickets Confirmed
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">
            You’re going to {order.eventTitle}!
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Hi {order.user || 'there'}, your payment has been received and
            your tickets are ready. Show the QR code below at the gate for
            entry.
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-white p-5 md:p-6">
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-5">
            <h3 className="text-base font-bold text-gray-900 md:text-lg">
              {order.eventTitle}
            </h3>
            <p className="mt-1 text-sm text-gray-500">{order.eventDate}</p>
            <p className="text-sm text-gray-500">
              {order.eventVenue
                ? `${order.eventVenue}, ${order.eventCity}`
                : order.eventCity}
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-dashed border-gray-200 pt-4 text-sm">
              <Field label="Section" value={order.section} />
              <Field label="Row" value={order.row || '—'} />
              <Field label="Tier" value={order.tierLabel} />
              <Field label="Quantity" value={`× ${order.quantity}`} />
            </dl>

            <div className="mt-5 flex flex-col items-center border-t border-dashed border-gray-200 pt-5">
              <img
                src={qrUrl}
                alt="Entry QR code"
                width={180}
                height={180}
                className="h-40 w-40"
              />
              <p className="mt-2 text-xs font-medium text-gray-500">
                Scan at venue for entry
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-gray-400">
                {order.id}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 px-6 py-4">
          <Row label="Subtotal" value={formatPrice(order.subtotal)} />
          <Row label="Service fee" value={formatPrice(order.fee)} />
          <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="text-sm font-semibold text-gray-700">Total Paid</span>
            <span className="text-base font-bold text-brand">
              {formatPrice(order.total)}
            </span>
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 text-center">
          <p className="text-xs text-gray-500">
            This email is your official receipt. Doors open one hour before
            showtime.
          </p>
          <p className="mt-1 text-[11px] text-gray-400">
            ticketmaster® · Sent to {order.email}
          </p>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm text-gray-600">
      <span>{label}</span>
      <span className="font-medium text-gray-700">{value}</span>
    </div>
  )
}

export function TicketEmailSummary({ order }) {
  if (!order) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Event" value={order.eventTitle} />
        <Field label="Date" value={order.eventDate} />
        <Field
          label="Section / Row"
          value={
            order.row
              ? `${order.section} \u2013 Row ${order.row}`
              : order.section
          }
        />
        <Field label="Quantity" value={`× ${order.quantity}`} />
      </div>
    </div>
  )
}

export { optionLabel }
