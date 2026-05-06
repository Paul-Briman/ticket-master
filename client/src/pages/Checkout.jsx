import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import OrderSummary from '../components/OrderSummary.jsx'
import CryptoPayment from '../components/CryptoPayment.jsx'
import { EVENTS } from '../data/events.js'
import { getSeatOptions, SERVICE_FEE_RATE, formatPrice } from '../lib/price.js'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'

export default function Checkout() {
  const location = useLocation()
  const state = location.state || {}
  const { user } = useAuth()

  const event = useMemo(() => {
    if (state.eventId) {
      const match = EVENTS.find((e) => e.id === state.eventId)
      if (match) return match
    }
    return EVENTS[0]
  }, [state.eventId])

  const option = useMemo(() => {
    const options = getSeatOptions(event)
    if (state.optionKey) {
      const match = options.find((o) => o.key === state.optionKey)
      if (match) return match
    }
    return options[2] || options[0]
  }, [event, state.optionKey])

  const quantity = state.quantity || 2

  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [status, setStatus] = useState('idle') // idle | submitting | pending
  const [pendingOrder, setPendingOrder] = useState(null)

  const canSubmit = name.trim() && email.trim() && status === 'idle'

  const [submitError, setSubmitError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit || !option) return
    setSubmitError('')
    setStatus('submitting')

    const subtotal = option.price * quantity
    const fee = subtotal * SERVICE_FEE_RATE
    const total = subtotal + fee

    try {
      const res = await api.createOrder({
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.date,
        eventVenue: event.venue || '',
        eventCity: event.city,
        eventCategory: event.category,
        eventImage: event.image,
        user: name.trim(),
        section: option.section,
        row: option.row,
        tier: option.tier,
        tierLabel: option.tierLabel,
        quantity,
        pricePerTicket: option.price,
        subtotal,
        fee,
        total,
      })
      setPendingOrder(res.order)
      setStatus('pending')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setStatus('idle')
      setSubmitError(err.message || 'Could not place order. Please try again.')
    }
  }

  if (status === 'pending' && pendingOrder) {
    return <PendingScreen order={pendingOrder} event={event} />
  }

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <div className="mb-6">
          <Link
            to={`/event/${event.id}`}
            className="text-sm font-medium text-brand hover:text-brand-dark"
          >
            ← Back to event
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">
            Checkout
          </h1>
          <p className="text-sm text-gray-500">
            Complete your order in 2 quick steps.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]"
        >
          <div className="flex flex-col gap-6">
            <section className="rounded-lg border border-gray-200 bg-white p-5 md:p-6">
              <Step number={1} title="Customer Information" />
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  label="Full Name"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Mobile tickets and payment confirmation will be sent to this
                email.
              </p>
            </section>

            <section>
              <Step number={2} title="Payment Method" className="mb-4" />
              <CryptoPayment />
            </section>

            <div className="flex flex-col gap-3">
              {submitError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {submitError}
                </div>
              )}
              <Button
                type="submit"
                size="lg"
                className="w-full md:w-auto md:self-start md:px-10"
                disabled={!canSubmit}
              >
                {status === 'submitting'
                  ? 'Submitting order...'
                  : 'I’ve Sent Payment'}
              </Button>

              <p className="text-xs text-gray-400">
                By submitting, you agree to our Terms of Service. Your tickets
                will be confirmed after we verify your payment on-chain.
              </p>
            </div>
          </div>

          <div className="lg:sticky lg:top-32 lg:self-start">
            <OrderSummary event={event} option={option} quantity={quantity} />
          </div>
        </form>
      </div>
    </div>
  )
}

function Step({ number, title, className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
        {number}
      </span>
      <h2 className="text-lg font-bold text-gray-900 md:text-xl">{title}</h2>
    </div>
  )
}

function PendingScreen({ order, event }) {
  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-12 md:py-20">
        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm md:p-10">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                className="h-6 w-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Payment Pending
              </p>
              <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
                We received your order
              </h1>
            </div>
          </div>

          <p className="mt-5 text-sm text-gray-600 md:text-base">
            Your tickets will be confirmed after payment verification. Once
            we’ve confirmed your crypto payment on-chain, an email with your
            mobile tickets will be sent to{' '}
            <span className="font-semibold text-gray-900">{order.email}</span>.
          </p>

          <div className="mt-6 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Order Details
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {order.eventTitle}
            </p>
            <p className="text-xs text-gray-500">
              {order.eventDate} ·{' '}
              {order.eventVenue || order.eventCity}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <Field label="Section" value={order.section} />
              <Field label="Row" value={order.row || '—'} />
              <Field label="Quantity" value={`× ${order.quantity}`} />
              <Field label="Total" value={formatPrice(order.total)} />
            </dl>
            <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
              Order ID:{' '}
              <span className="font-mono font-medium text-gray-700">
                {order.id}
              </span>
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Link to="/">
              <Button variant="secondary" className="w-full sm:w-auto">
                Back to home
              </Button>
            </Link>
            <Link to={`/event/${event.id}`}>
              <Button className="w-full sm:w-auto">View event</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900">{value}</dd>
    </div>
  )
}
