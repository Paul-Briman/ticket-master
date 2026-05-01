import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import OrderSummary from '../components/OrderSummary.jsx'
import CryptoPayment from '../components/CryptoPayment.jsx'
import { EVENTS } from '../data/events.js'
import { getSeatTiers } from '../lib/price.js'

export default function Checkout() {
  const location = useLocation()
  const state = location.state || {}

  const event = useMemo(() => {
    if (state.eventId) {
      const match = EVENTS.find((e) => e.id === state.eventId)
      if (match) return match
    }
    return EVENTS[0]
  }, [state.eventId])

  const tier = useMemo(() => {
    const tiers = getSeatTiers(event)
    if (state.tierKey) {
      const match = tiers.find((t) => t.key === state.tierKey)
      if (match) return match
    }
    return tiers[1] || tiers[0]
  }, [event, state.tierKey])

  const quantity = state.quantity || 2

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | processing | success

  const canSubmit = name.trim() && email.trim() && status === 'idle'

  function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setStatus('processing')
    setTimeout(() => setStatus('success'), 2000)
  }

  if (status === 'success') {
    return <SuccessScreen event={event} email={email} />
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
                Mobile tickets and order confirmation will be sent to this
                email.
              </p>
            </section>

            <section>
              <Step number={2} title="Payment Method" className="mb-4" />
              <CryptoPayment />
            </section>

            <div className="flex flex-col gap-3">
              <Button
                type="submit"
                size="lg"
                className="w-full md:w-auto md:self-start md:px-10"
                disabled={!canSubmit}
              >
                {status === 'processing'
                  ? 'Verifying payment...'
                  : 'Complete Payment'}
              </Button>

              {status === 'processing' && (
                <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-brand">
                  <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-brand" />
                  Waiting for blockchain confirmation. This may take a few
                  seconds...
                </div>
              )}

              <p className="text-xs text-gray-400">
                By completing payment you agree to our Terms of Service and
                Refund Policy. This is a mock transaction — no real payment is
                processed.
              </p>
            </div>
          </div>

          <div className="lg:sticky lg:top-32 lg:self-start">
            <OrderSummary event={event} tier={tier} quantity={quantity} />
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

function SuccessScreen({ event, email }) {
  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-16 md:py-24">
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm md:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              className="h-7 w-7"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="mt-5 text-2xl font-bold text-gray-900 md:text-3xl">
            Payment received
          </h1>
          <p className="mt-2 text-gray-600">
            Your tickets have been confirmed.
          </p>

          <div className="mt-6 rounded-lg border border-gray-100 bg-gray-50 p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Event
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {event.title}
            </p>
            <p className="text-xs text-gray-500">
              {event.date} · {event.venue || event.city}
            </p>
            {email && (
              <p className="mt-3 text-xs text-gray-500">
                A receipt was sent to{' '}
                <span className="font-medium text-gray-700">{email}</span>.
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
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
