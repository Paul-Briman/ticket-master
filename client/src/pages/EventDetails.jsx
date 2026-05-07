import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EventHero from '../components/EventHero.jsx'
import SeatSelector from '../components/SeatSelector.jsx'
import TicketSummary from '../components/TicketSummary.jsx'
import Section from '../components/Section.jsx'
import EventCard from '../components/EventCard.jsx'
import CardScroller from '../components/CardScroller.jsx'
import Button from '../components/Button.jsx'
import EventCountdown from '../components/EventCountdown.jsx'
import FavoriteButton from '../components/FavoriteButton.jsx'
import TrustBadges from '../components/TrustBadges.jsx'
import { EVENTS } from '../data/events.js'
import { formatPrice, getSeatOptions, SERVICE_FEE_RATE } from '../lib/price.js'
import { recordRecentView } from '../lib/recentlyViewed.js'
import { parseEventDate } from '../lib/dateParse.js'
import { useSportsEvent } from '../lib/useSportsEvents.js'

export default function EventDetails() {
  const { id } = useParams()
  const localEvent = EVENTS.find((e) => e.id === id)
  const isLiveId = !localEvent && typeof id === 'string' && id.startsWith('sdb-')
  const { event: liveEvent, loading: liveLoading, error: liveError } = useSportsEvent(
    isLiveId ? id : null,
    { enabled: isLiveId },
  )
  const event = localEvent || liveEvent

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
    if (event?.id) recordRecentView(event.id)
  }, [id, event?.id])

  const targetDate = useMemo(() => parseEventDate(event?.date), [event?.date])

  const options = useMemo(() => (event ? getSeatOptions(event) : []), [event])
  const [selectedKey, setSelectedKey] = useState(null)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    setSelectedKey(null)
    setQuantity(1)
  }, [id])

  if (liveLoading) {
    return (
      <div className="container-page py-20 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
        <p className="mt-4 text-sm text-gray-500">Loading event...</p>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Event not found</h1>
        <p className="mt-2 text-gray-500">
          {liveError
            ? 'We couldn’t load this event. It may have ended or been removed.'
            : 'The event you’re looking for doesn’t exist or has been removed.'}
        </p>
        <Link
          to="/"
          className="mt-6 inline-block text-sm font-medium text-brand hover:text-brand-dark"
        >
          ← Back to home
        </Link>
      </div>
    )
  }

  const selectedOption = options.find((o) => o.key === selectedKey) || null
  const subtotal = (selectedOption?.price || 0) * quantity
  const total = subtotal + subtotal * SERVICE_FEE_RATE

  const related = EVENTS.filter(
    (e) => e.category === event.category && e.id !== event.id,
  ).slice(0, 6)

  return (
    <div className="flex flex-col pb-24 md:pb-0">
      <EventHero event={event} />

      <section className="bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
            <div className="flex flex-col gap-6">
              {targetDate && (
                <article className="rounded-lg border border-gray-200 bg-gradient-to-br from-blue-600 to-blue-800 p-5 text-white md:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
                        Event begins in
                      </p>
                      <h3 className="mt-1 text-base font-bold md:text-lg">
                        {event.title}
                      </h3>
                    </div>
                    <EventCountdown targetDate={targetDate} />
                  </div>
                </article>
              )}

              <article className="rounded-lg border border-gray-200 bg-white p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-gray-900 md:text-2xl">
                      About this event
                    </h2>
                  </div>
                  <FavoriteButton
                    eventId={event.id}
                    eventTitle={event.title}
                    variant="inline"
                  />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-gray-600 md:text-base">
                  Don’t miss <strong>{event.title}</strong> at{' '}
                  <strong>{event.venue || event.city}</strong>. Doors open one
                  hour before the event starts. Mobile tickets will be
                  delivered straight to your TicketMaster account up to 48
                  hours before showtime. All sales are final.
                </p>

                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                  <Detail label="Date" value={event.date} />
                  <Detail label="Venue" value={event.venue} />
                  <Detail label="City" value={event.city} />
                  <Detail label="Starting from" value={event.price} />
                </dl>

                <div className="mt-5">
                  <TrustBadges />
                </div>
              </article>

              <SeatSelector
                event={event}
                options={options}
                selectedKey={selectedKey}
                onSelect={setSelectedKey}
              />
            </div>

            <div className="lg:sticky lg:top-32 lg:self-start">
              <TicketSummary
                event={event}
                option={selectedOption}
                quantity={quantity}
                onQuantityChange={setQuantity}
              />
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <Section title="You May Also Like" subtitle="Similar events you might enjoy">
          <CardScroller>
            {related.map((rel) => (
              <EventCard
                key={rel.id}
                {...rel}
                location={
                  rel.venue ? `${rel.venue}, ${rel.city}` : rel.city
                }
              />
            ))}
          </CardScroller>
        </Section>
      )}

      <MobileStickyCTA
        total={total}
        disabled={!selectedOption}
        checkoutState={
          selectedOption
            ? { eventId: event.id, optionKey: selectedOption.key, quantity }
            : null
        }
      />
    </div>
  )
}

function Detail({ label, value }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-gray-900">{value}</dd>
    </div>
  )
}

function MobileStickyCTA({ total, disabled, checkoutState }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-base font-bold text-gray-900">
            {formatPrice(total)}
          </p>
        </div>
        <Link
          to={disabled ? '#' : '/checkout'}
          state={disabled ? null : checkoutState}
          onClick={(e) => {
            if (disabled) e.preventDefault()
          }}
          className="flex-1"
        >
          <Button className="w-full" disabled={disabled}>
            {disabled ? 'Select a section' : 'Checkout'}
          </Button>
        </Link>
      </div>
    </div>
  )
}
