import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/Button.jsx'
import Modal from '../components/Modal.jsx'
import TicketEmail from '../components/TicketEmail.jsx'
import { useAuth } from '../lib/auth.jsx'
import { useAdminStore, ORDER_STATUS } from '../lib/adminStore.jsx'
import { formatPrice, optionLabel } from '../lib/price.js'

export default function MyTickets() {
  const { user } = useAuth()
  const { orders } = useAdminStore()
  const [viewing, setViewing] = useState(null)

  const myTickets = useMemo(() => {
    if (!user) return []
    const userEmail = user.email.toLowerCase()
    return orders.filter(
      (o) =>
        o.status === ORDER_STATUS.PAID &&
        (o.email || '').toLowerCase() === userEmail,
    )
  }, [orders, user])

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-12 md:py-16">
        <header>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            My Tickets
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {user?.name ? `Welcome back, ${user.name}. ` : ''}
            {myTickets.length} confirmed ticket
            {myTickets.length === 1 ? '' : 's'}.
          </p>
        </header>

        {myTickets.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="mt-8 flex flex-col gap-4">
            {myTickets.map((ticket) => (
              <li key={ticket.id}>
                <TicketCard
                  ticket={ticket}
                  onView={() => setViewing(ticket)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

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
        {viewing && <TicketEmail order={viewing} />}
      </Modal>
    </div>
  )
}

function TicketCard({ ticket, onView }) {
  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto]">
        <div className="flex">
          {ticket.eventImage && (
            <img
              src={ticket.eventImage}
              alt=""
              className="hidden h-auto w-32 shrink-0 object-cover sm:block md:w-40"
              loading="lazy"
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
        You have no confirmed tickets yet
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
        Once your payment is verified, your mobile tickets will appear here
        automatically.
      </p>
      <Link to="/" className="mt-5 inline-block">
        <Button>Browse events</Button>
      </Link>
    </div>
  )
}
