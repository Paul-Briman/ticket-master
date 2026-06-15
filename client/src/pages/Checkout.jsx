import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import OrderSummary from '../components/OrderSummary.jsx'
import CryptoPayment from '../components/CryptoPayment.jsx'
import AppleGiftCardPayment from '../components/AppleGiftCardPayment.jsx'
import { getSeatOptions, SERVICE_FEE_RATE, formatPrice } from '../lib/price.js'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import { useEvent } from '../lib/useEvent.js'

const PAYMENT_METHODS = [
  {
    key: 'crypto',
    label: 'Cryptocurrency',
    sublabel: 'BTC · ETH · USDT',
  },
  {
    key: 'apple-gift-card',
    label: 'Apple Gift Card',
    sublabel: 'Upload front + back',
  },
]

export default function Checkout() {
  const location = useLocation()
  const state = location.state || {}
  const { user } = useAuth()

  // The full event passed via navigation state seeds the page so we
  // can render instantly, but the source of truth for pricing is the
  // unified detail endpoint (DB ⊕ override). useEvent will swap in the
  // canonical record as soon as it resolves, picking up any admin
  // pricing edits that happened after the user clicked Checkout.
  const seededId = state.event?.id || state.eventId || null
  const { event: liveEvent } = useEvent(seededId, {
    enabled: !!seededId,
    seed: state.event || null,
  })
  const event = liveEvent || state.event || null

  const option = useMemo(() => {
    if (!event) return null
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
  const [paymentMethod, setPaymentMethod] = useState('crypto')
  const [giftCardImages, setGiftCardImages] = useState({
    frontImage: null,
    backImage: null,
  })

  const [submitError, setSubmitError] = useState('')

  const giftCardReady =
    !!giftCardImages.frontImage && !!giftCardImages.backImage
  // Crypto submit is enabled as soon as customer details are filled
  // (existing behaviour). Apple Gift Card submit additionally requires
  // both photos to be uploaded — preventing a stub order without proof.
  const methodReady = paymentMethod === 'apple-gift-card' ? giftCardReady : true
  const canSubmit =
    name.trim() && email.trim() && status === 'idle' && methodReady

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit || !option) return
    setSubmitError('')
    setStatus('submitting')

    const subtotal = option.price * quantity
    const fee = subtotal * SERVICE_FEE_RATE
    const total = subtotal + fee

    try {
      const payload = {
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
        paymentMethod,
      }
      if (paymentMethod === 'apple-gift-card') {
        payload.giftCardFrontImage = giftCardImages.frontImage
        payload.giftCardBackImage = giftCardImages.backImage
      }
      const res = await api.createOrder(payload)
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

  if (!event) {
    return (
      <div className="bg-gray-50">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900">No event selected</h1>
          <p className="mt-2 text-sm text-gray-500">
            Pick an event and a section first, then come back to checkout.
          </p>
          <Link
            to="/"
            className="mt-6 inline-block text-sm font-medium text-brand hover:text-brand-dark"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    )
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

            <section className="flex flex-col gap-4">
              <Step number={2} title="Payment Method" />

              {/* Method selector — radio-style pills. Each one swaps
                  in its own instructions component below without
                  touching the surrounding submit flow. */}
              <div
                role="radiogroup"
                aria-label="Payment method"
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              >
                {PAYMENT_METHODS.map((m) => {
                  const active = paymentMethod === m.key
                  return (
                    <button
                      key={m.key}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setPaymentMethod(m.key)}
                      className={`flex flex-col items-start rounded-lg border p-3 text-left transition-colors ${
                        active
                          ? 'border-brand bg-blue-50/60 ring-2 ring-brand/30'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <span className="text-sm font-semibold text-gray-900">
                        {m.label}
                      </span>
                      <span className="mt-0.5 text-xs text-gray-500">
                        {m.sublabel}
                      </span>
                    </button>
                  )
                })}
              </div>

              {paymentMethod === 'crypto' && <CryptoPayment />}
              {paymentMethod === 'apple-gift-card' && (
                <AppleGiftCardPayment
                  total={
                    option ? option.price * quantity * (1 + SERVICE_FEE_RATE) : 0
                  }
                  frontImage={giftCardImages.frontImage}
                  backImage={giftCardImages.backImage}
                  onImagesChange={(imgs) => setGiftCardImages(imgs)}
                />
              )}
            </section>

            <div className="flex flex-col gap-3">
              {submitError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {submitError}
                </div>
              )}
              {paymentMethod === 'apple-gift-card' && !giftCardReady && (
                <p className="text-xs text-amber-700">
                  Upload both photos of the gift card above to enable submission.
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                className="w-full md:w-auto md:self-start md:px-10"
                disabled={!canSubmit}
              >
                {status === 'submitting'
                  ? 'Submitting order...'
                  : paymentMethod === 'apple-gift-card'
                    ? 'Submit gift card for verification'
                    : "I've Sent Payment"}
              </Button>

              <p className="text-xs text-gray-400">
                By submitting, you agree to our Terms of Service. Your tickets
                will be confirmed after we verify your payment.
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
  const isGiftCard = order.paymentMethod === 'apple-gift-card'
  const pillLabel = isGiftCard ? 'Pending Gift Card Verification' : 'Payment Pending'
  const body = isGiftCard
    ? 'Your payment proof has been received and is awaiting review. Once we verify your Apple Gift Card balance, an email with your mobile tickets will be sent to '
    : "Your tickets will be confirmed after payment verification. Once we've confirmed your crypto payment on-chain, an email with your mobile tickets will be sent to "
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
                {pillLabel}
              </p>
              <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
                We received your order
              </h1>
            </div>
          </div>

          <p className="mt-5 text-sm text-gray-600 md:text-base">
            {body}
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
              <Button variant="secondary" className="w-full sm:w-auto">
                View event
              </Button>
            </Link>
            <Link to="/my-tickets">
              <Button className="w-full sm:w-auto">View my tickets</Button>
            </Link>
          </div>
          <p className="mt-3 text-center text-xs text-gray-500 sm:text-right">
            Your order is already in <strong>My Tickets</strong> as <em>Pending
            Verification</em> — you can track confirmation status there.
          </p>
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
