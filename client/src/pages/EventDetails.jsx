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
import PromotionBadge, {
  formatPromotionLabel,
} from '../components/PromotionBadge.jsx'
import PromotionCountdown from '../components/PromotionCountdown.jsx'
import { formatPrice, getSeatOptions, SERVICE_FEE_RATE } from '../lib/price.js'
import { recordRecentView } from '../lib/recentlyViewed.js'
import { parseEventDate } from '../lib/dateParse.js'
import { useSportsEvents } from '../lib/useSportsEvents.js'
import { useEventList } from '../lib/useEventList.js'
import { useEvent } from '../lib/useEvent.js'
import { isEventExpired, isEventVisible } from '../lib/eventExpiry.js'

export default function EventDetails() {
  const { id } = useParams()
  // Every detail page goes through the unified DB-first endpoint so
  // admin overrides (pricing, venue, image, etc.) always reflect — no
  // direct catalog reads, no per-category branching.
  const { event, loading: liveLoading, error: liveError } = useEvent(id, {
    enabled: !!id,
  })

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
    // Only stash upcoming events into recently-viewed. An expired
    // event shouldn't keep advertising itself on the homepage lane.
    if (event?.id && !isEventExpired(event)) recordRecentView(event)
  }, [id, event?.id])

  const targetDate = useMemo(() => parseEventDate(event?.date), [event?.date])

  const options = useMemo(() => (event ? getSeatOptions(event) : []), [event])
  const [selectedKey, setSelectedKey] = useState(null)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    setSelectedKey(null)
    setQuantity(1)
  }, [id])

  // IMPORTANT: these hooks MUST run on every render — including the
  // loading/not-found render paths below — so their position in the
  // hooks order stays stable. Both hooks use their `enabled` flag to
  // short-circuit when the event isn't the matching category yet.
  const isSportsEvent = event?.category === 'sports'
  const isCuratedCategory =
    event?.category === 'concerts' ||
    event?.category === 'arts' ||
    event?.category === 'family'

  const { events: liveRelated } = useSportsEvents(
    { league: event?.league, size: 8 },
    { enabled: !!isSportsEvent && !!event?.league },
  )

  // Recommendations for concerts / arts / family come from the SAME
  // backend endpoint that renders the homepage lane — provider +
  // admin overrides + promotions already applied. Previously we
  // filtered the raw client-side EVENTS catalog which was pre-
  // override, so a related-event card could show "Concert A" while
  // clicking through opened the overridden "Taylor Swift" event.
  const { events: curatedRelated } = useEventList(
    // Dummy fallback category when disabled (hook needs a valid
    // FETCHERS key even though it won't fetch). useEventList exits
    // early with empty state when enabled=false.
    isCuratedCategory ? event.category : 'concerts',
    { size: 8 },
    { enabled: !!isCuratedCategory },
  )

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

  const expired = isEventExpired(event)

  const selectedOption = options.find((o) => o.key === selectedKey) || null
  const subtotal = (selectedOption?.price || 0) * quantity
  const total = subtotal + subtotal * SERVICE_FEE_RATE

  // Recommendations. Both branches now flow from the SAME backend
  // pipeline that renders the detail page above — normalize →
  // admin override merge → promotion decoration → expiry filter —
  // so a related card never shows stale mock data. Strip the
  // current event out and cap at 6 cards.
  const related = (isSportsEvent
    ? liveRelated
    : isCuratedCategory
      ? curatedRelated
      : []
  )
    .filter((e) => e.id !== event.id)
    .filter(isEventVisible)
    .slice(0, 6)

  return (
    <div className="flex flex-col pb-24 md:pb-0">
      <EventHero event={event} />

      <section className="bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
            <div className="flex flex-col gap-6">
              {!expired && event.promotion && (
                <PromotionBanner
                  promotion={event.promotion}
                  // Reload the page if the timer hits zero — the next
                  // detail response will come back without a promotion
                  // field, so all the discounted prices/badges
                  // disappear automatically.
                  onExpire={() => window.location.reload()}
                />
              )}

              {expired ? (
                <article className="rounded-lg border border-amber-200 bg-amber-50 p-5 md:p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                    Event has ended
                  </p>
                  <h3 className="mt-1 text-base font-bold text-amber-900 md:text-lg">
                    Ticket sales are closed for this event.
                  </h3>
                  <p className="mt-2 text-sm text-amber-800">
                    Browse upcoming events instead — here are similar shows
                    you may like below.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      to={
                        event.category === 'sports'
                          ? event.league
                            ? `/sports/${event.league}`
                            : '/sports'
                          : `/${event.category}`
                      }
                    >
                      <Button variant="primary" size="md">
                        Browse upcoming {event.category}
                      </Button>
                    </Link>
                    <Link to="/">
                      <Button variant="secondary" size="md">
                        Back to home
                      </Button>
                    </Link>
                  </div>
                </article>
              ) : (
                targetDate && (
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
                )
              )}

              <article className="rounded-lg border border-gray-200 bg-white p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-gray-900 md:text-2xl">
                      About this event
                    </h2>
                  </div>
                  <FavoriteButton event={event} variant="inline" />
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

              {!expired && (
                <SeatSelector
                  event={event}
                  options={options}
                  selectedKey={selectedKey}
                  onSelect={setSelectedKey}
                />
              )}
            </div>

            <div className="lg:sticky lg:top-32 lg:self-start">
              {expired ? (
                <aside className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm md:p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Tickets unavailable
                  </p>
                  <p className="mt-1 text-base font-bold text-gray-900">
                    This event has ended.
                  </p>
                  <p className="mt-3 text-sm text-gray-600">
                    Sales close the moment the event begins. Check out the
                    upcoming events below — we'll have something you'll love.
                  </p>
                </aside>
              ) : (
                <TicketSummary
                  event={event}
                  option={selectedOption}
                  quantity={quantity}
                  onQuantityChange={setQuantity}
                />
              )}
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

      {!expired && (
        <MobileStickyCTA
          total={total}
          disabled={!selectedOption}
          checkoutState={
            selectedOption
              ? { event, eventId: event.id, optionKey: selectedOption.key, quantity }
              : null
          }
        />
      )}
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

function PromotionBanner({ promotion, onExpire }) {
  if (!promotion) return null
  return (
    <article className="overflow-hidden rounded-lg border border-blue-200 bg-gradient-to-br from-blue-700 via-brand to-blue-900 p-5 text-white shadow-md md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur">
              Limited time
            </span>
            <PromotionBadge promotion={promotion} size="md" />
          </div>
          <h3 className="mt-2 text-lg font-bold leading-tight md:text-xl">
            {promotion.name}
          </h3>
          <p className="mt-1 text-sm text-white/85">
            Get <strong>{formatPromotionLabel(promotion)}</strong> automatically
            applied at checkout. Sale ends when the timer hits zero.
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 md:items-end">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
            Sale ends in
          </span>
          <PromotionCountdown endsAt={promotion.endsAt} onExpire={onExpire} />
        </div>
      </div>
    </article>
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
