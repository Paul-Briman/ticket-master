import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/Button.jsx'
import Modal from '../components/Modal.jsx'
import TicketEmail from '../components/TicketEmail.jsx'
import { SkeletonRow } from '../components/Skeleton.jsx'
import { useAuth } from '../lib/auth.jsx'
import { ORDER_STATUS } from '../lib/adminStore.jsx'
import { api } from '../lib/api.js'
import { formatPrice, optionLabel } from '../lib/price.js'
import Image from '../components/Image.jsx'

export default function MyTickets() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewing, setViewing] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await api.myOrders()
        if (!cancelled) setOrders(res.orders || [])
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load tickets.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Split into status buckets. Each section renders only its own
  // status; that way a card type (Pending / Confirmed / Rejected)
  // can carry exactly the right capabilities (e.g. only Confirmed
  // ever exposes the QR-bearing View Ticket modal).
  const { confirmed, pending, rejected } = useMemo(() => {
    const c = []
    const p = []
    const r = []
    for (const o of orders) {
      if (o.status === ORDER_STATUS.PAID) c.push(o)
      else if (o.status === ORDER_STATUS.REJECTED) r.push(o)
      else p.push(o) // anything else (pending or legacy) treated as pending
    }
    return { confirmed: c, pending: p, rejected: r }
  }, [orders])

  const counts = `${confirmed.length} confirmed · ${pending.length} pending${
    rejected.length > 0 ? ` · ${rejected.length} rejected` : ''
  }`

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-12 md:py-16">
        <header>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            My Tickets
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {user?.name ? `Welcome back, ${user.name}. ` : ''}
            {loading ? 'Loading your tickets...' : counts}
          </p>
        </header>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <ul className="mt-8 flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i}>
                <SkeletonRow height="h-24" />
              </li>
            ))}
          </ul>
        ) : orders.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-8 flex flex-col gap-10">
            {pending.length > 0 && (
              <Section
                title="Pending Verification"
                subtitle="We've received your payment submission. Your ticket will be issued after payment confirmation."
                tone="pending"
              >
                {pending.map((t) => (
                  <PendingCard key={t.id} ticket={t} />
                ))}
              </Section>
            )}
            {/* Note: PendingCard already distinguishes the pill text
                and body copy by ticket.paymentMethod below — no second
                section needed; both crypto and gift-card pending orders
                share the same UI slot with method-specific labels. */}

            {confirmed.length > 0 && (
              <Section
                title="Confirmed Tickets"
                subtitle="Ready to scan at the venue."
                tone="confirmed"
              >
                {confirmed.map((t) => (
                  <ConfirmedCard
                    key={t.id}
                    ticket={t}
                    onView={() => setViewing(t)}
                  />
                ))}
              </Section>
            )}

            {rejected.length > 0 && (
              <Section
                title="Rejected"
                subtitle="These orders couldn't be confirmed. Contact support if you believe this is wrong."
                tone="rejected"
              >
                {rejected.map((t) => (
                  <RejectedCard key={t.id} ticket={t} />
                ))}
              </Section>
            )}
          </div>
        )}
      </div>

      {/* Only confirmed tickets ever get rendered into this modal —
          the QR code and barcode live inside <TicketEmail/>, and a
          pending/rejected card has no button that can open this. */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Mobile Ticket"
        footer={
          <Button
            variant="secondary"
            type="button"
            onClick={() => setViewing(null)}
          >
            Close
          </Button>
        }
      >
        {viewing && viewing.status === ORDER_STATUS.PAID && (
          <TicketEmail order={viewing} />
        )}
      </Modal>
    </div>
  )
}

function Section({ title, subtitle, tone, children }) {
  const accent =
    tone === 'pending'
      ? 'border-amber-200'
      : tone === 'rejected'
        ? 'border-red-200'
        : 'border-gray-200'
  return (
    <section>
      <div className={`mb-3 flex items-baseline gap-3 border-b pb-2 ${accent}`}>
        <h2 className="text-lg font-bold text-gray-900 md:text-xl">{title}</h2>
        {subtitle && (
          <span className="text-xs text-gray-500 md:text-sm">{subtitle}</span>
        )}
      </div>
      <ul className="flex flex-col gap-4">
        {Array.isArray(children) ? children : [children]}
      </ul>
    </section>
  )
}

function ConfirmedCard({ ticket, onView }) {
  return (
    <li>
      <article className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto]">
          <div className="flex">
            {ticket.eventImage && (
              <Image
                src={ticket.eventImage}
                alt=""
                className="hidden h-auto w-32 shrink-0 object-cover sm:block md:w-40"
              />
            )}
            <div className="min-w-0 flex-1 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                  ✓ Paid
                </span>
                <span className="font-mono text-[11px] text-gray-400">
                  {ticket.id}
                </span>
              </div>

              <h2 className="mt-2 truncate text-lg font-bold text-gray-900">
                {ticket.eventTitle}
              </h2>
              <p className="text-sm text-gray-500">{ticket.eventDate}</p>
              <p className="text-sm text-gray-500">
                {ticket.eventVenue
                  ? `${ticket.eventVenue}, ${ticket.eventCity}`
                  : ticket.eventCity}
              </p>

              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-gray-100 pt-3 text-sm">
                <Field label="Seats" value={optionLabel(ticket)} />
                <Field label="Tier" value={ticket.tierLabel} />
                <Field label="Quantity" value={`× ${ticket.quantity}`} />
              </dl>
            </div>
          </div>

          <div className="flex flex-col items-stretch justify-between gap-3 border-t border-gray-100 bg-gray-50 p-5 md:min-w-[200px] md:items-end md:border-l md:border-t-0">
            <div className="md:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Total Paid
              </p>
              <p className="text-2xl font-bold text-brand">
                {formatPrice(ticket.total)}
              </p>
            </div>
            <Button onClick={onView} className="w-full md:w-auto">
              View Ticket
            </Button>
          </div>
        </div>
      </article>
    </li>
  )
}

function PendingCard({ ticket }) {
  const isGiftCard = ticket.paymentMethod === 'apple-gift-card'
  const pillText = isGiftCard
    ? '⏳ Pending Gift Card Verification'
    : '⏳ Pending Verification'
  const bodyText = isGiftCard
    ? 'Your payment proof has been received and is awaiting review. As soon as we verify the Apple Gift Card balance, your mobile ticket will appear here.'
    : "We have received your payment submission. Your ticket will be issued after payment confirmation. You'll be able to view your mobile ticket here as soon as it's confirmed."
  return (
    <li>
      <article className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50/40 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto]">
          <div className="flex">
            {ticket.eventImage && (
              <Image
                src={ticket.eventImage}
                alt=""
                className="hidden h-auto w-32 shrink-0 object-cover sm:block md:w-40"
              />
            )}
            <div className="min-w-0 flex-1 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {pillText}
                </span>
                <span className="font-mono text-[11px] text-gray-400">
                  {ticket.id}
                </span>
              </div>

              <h2 className="mt-2 truncate text-lg font-bold text-gray-900">
                {ticket.eventTitle}
              </h2>
              <p className="text-sm text-gray-600">{ticket.eventDate}</p>
              <p className="text-sm text-gray-600">
                {ticket.eventVenue
                  ? `${ticket.eventVenue}, ${ticket.eventCity}`
                  : ticket.eventCity}
              </p>

              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-amber-200/60 pt-3 text-sm">
                <Field label="Seats" value={optionLabel(ticket)} />
                <Field label="Tier" value={ticket.tierLabel} />
                <Field label="Quantity" value={`× ${ticket.quantity}`} />
              </dl>

              <p className="mt-4 text-sm text-amber-900">{bodyText}</p>
            </div>
          </div>

          <div className="flex flex-col items-stretch justify-between gap-3 border-t border-amber-200/60 bg-amber-50 p-5 md:min-w-[200px] md:items-end md:border-l md:border-t-0">
            <div className="md:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                Submitted
              </p>
              <p className="text-2xl font-bold text-amber-900">
                {formatPrice(ticket.total)}
              </p>
            </div>
            <span className="rounded-md border border-amber-200 bg-white/60 px-2.5 py-1 text-center text-xs font-medium text-amber-800 md:self-end">
              No ticket yet — awaiting verification
            </span>
          </div>
        </div>
      </article>
    </li>
  )
}

function RejectedCard({ ticket }) {
  return (
    <li>
      <article className="overflow-hidden rounded-lg border border-red-200 bg-red-50/40 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto]">
          <div className="flex">
            {ticket.eventImage && (
              <Image
                src={ticket.eventImage}
                alt=""
                className="hidden h-auto w-32 shrink-0 object-cover opacity-60 sm:block md:w-40"
              />
            )}
            <div className="min-w-0 flex-1 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                  ❌ Payment Rejected
                </span>
                <span className="font-mono text-[11px] text-gray-400">
                  {ticket.id}
                </span>
              </div>

              <h2 className="mt-2 truncate text-lg font-bold text-gray-900">
                {ticket.eventTitle}
              </h2>
              <p className="text-sm text-gray-600">{ticket.eventDate}</p>
              <p className="text-sm text-gray-600">
                {ticket.eventVenue
                  ? `${ticket.eventVenue}, ${ticket.eventCity}`
                  : ticket.eventCity}
              </p>

              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-red-200/60 pt-3 text-sm">
                <Field label="Seats" value={optionLabel(ticket)} />
                <Field label="Tier" value={ticket.tierLabel} />
                <Field label="Quantity" value={`× ${ticket.quantity}`} />
              </dl>

              {ticket.rejectionReason ? (
                <p className="mt-4 rounded-md border border-red-200 bg-white/60 px-3 py-2 text-sm text-red-900">
                  <span className="font-semibold">Reason from admin:</span>{' '}
                  {ticket.rejectionReason}
                </p>
              ) : (
                <p className="mt-4 text-sm text-red-900">
                  Your payment couldn't be verified. If you believe this is a
                  mistake, contact support and reference the order ID above.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-stretch justify-between gap-3 border-t border-red-200/60 bg-red-50 p-5 md:min-w-[200px] md:items-end md:border-l md:border-t-0">
            <div className="md:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-red-700">
                Not charged
              </p>
              <p className="text-2xl font-bold text-red-900 line-through">
                {formatPrice(ticket.total)}
              </p>
            </div>
          </div>
        </div>
      </article>
    </li>
  )
}

function Field({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-gray-900">
        {value}
      </dd>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="mt-8 rounded-lg border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
      <h2 className="text-base font-semibold text-gray-900">
        You haven't placed any orders yet
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
        Browse events, pick your seats, and submit a payment — your orders
        will appear here immediately, before and after admin confirmation.
      </p>
      <Link to="/" className="mt-5 inline-block">
        <Button>Browse events</Button>
      </Link>
    </div>
  )
}
