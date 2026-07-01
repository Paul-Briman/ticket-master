// Two render paths:
//
// 1. Versus hero — for any team-vs-team fixture where the normalized
//    event carries both teams AND both crests (currently World Cup +
//    UCL via football-data; automatically applies to any future
//    provider that populates the same fields). Mirrors the visual
//    language of the EventCard's VersusVisual but scaled up to hero
//    size, so the homepage card and the detail hero stay consistent.
//
// 2. Image hero — the original full-bleed event.image background with
//    a dark gradient overlay. Used by every other event: NBA / NFL /
//    MLB / F1 / UFC / Tennis / Boxing (sportdb doesn't carry per-team
//    crests), concerts, arts, family, and any admin-created event.
//
// The decision turns on whether BOTH crests AND BOTH team names are
// present — partial data falls through to the image hero rather than
// rendering a one-sided versus visual.

import Image from './Image.jsx'

function categoryLabel(category) {
  if (category === 'concerts') return 'Live Concert'
  if (category === 'arts') return 'Arts & Theater'
  if (category === 'family') return 'Family Event'
  return 'Live Sports'
}

export default function EventHero({ event }) {
  const location = [event.venue, event.city, event.country]
    .filter(Boolean)
    .join(' · ')

  const hasVersus = !!(
    event.homeTeam &&
    event.awayTeam &&
    event.homeCrest &&
    event.awayCrest
  )

  if (hasVersus) {
    return (
      <VersusHero
        event={event}
        category={categoryLabel(event.category)}
        location={location}
      />
    )
  }

  return (
    <ImageHero
      event={event}
      category={categoryLabel(event.category)}
      location={location}
    />
  )
}

function VersusHero({ event, category, location }) {
  return (
    <section
      className="relative isolate overflow-hidden bg-gradient-to-br from-blue-700 via-brand to-blue-900"
      aria-label={`${event.homeTeam} vs ${event.awayTeam}`}
    >
      {/* Subtle background — try event.image (competition emblem or
          team logo) as a very faint watermark for visual texture.
          Falls back gracefully if missing. */}
      {event.image && (
        <div className="absolute inset-0 -z-10">
          {/* Background watermark on the versus hero is decorative
              only — sits at 10% opacity behind a heavy gradient. Not
              a priority image; skip fetch prioritization. */}
          <Image
            src={event.image}
            alt=""
            aria-hidden
            className="h-full w-full object-cover opacity-10 blur-md"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-700/95 via-brand/90 to-blue-900/95" />
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-16">
        <span className="inline-block rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur">
          {category}
        </span>

        {/* Crests side-by-side. The flexbox layout shrinks gracefully
            on mobile — the gap collapses and crests scale down but
            stay readable side-by-side, not stacked, because the whole
            point of the visual is "A vs B" at a glance. */}
        <div className="mt-6 flex w-full items-center justify-center gap-4 sm:gap-8 md:mt-8 md:gap-16">
          <TeamBlock
            name={event.homeTeam}
            crest={event.homeCrest}
            sideLabel="HOME"
          />

          <div className="flex shrink-0 flex-col items-center gap-2">
            <span className="rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white shadow-sm backdrop-blur md:px-5 md:py-2 md:text-sm">
              VS
            </span>
          </div>

          <TeamBlock
            name={event.awayTeam}
            crest={event.awayCrest}
            sideLabel="AWAY"
          />
        </div>

        {/* Title is still in the DOM for SEO + a11y, but visually
            secondary — the crests are the hero. */}
        <h1 className="sr-only">{event.title}</h1>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/90 md:mt-8 md:text-base">
          {event.date && (
            <span className="flex items-center gap-2">
              <span aria-hidden>📅</span>
              {event.date}
            </span>
          )}
          {location && (
            <span className="flex items-center gap-2">
              <span aria-hidden>📍</span>
              {location}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}

function TeamBlock({ name, crest, sideLabel }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center md:gap-3">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white p-2 shadow-lg shadow-blue-900/40 sm:h-24 sm:w-24 md:h-32 md:w-32 md:p-3">
        {crest ? (
          <Image
            src={crest}
            alt={name || sideLabel}
            className="h-full w-full object-contain"
            // Above-the-fold hero crest — prioritize so the versus
            // visual paints on first frame instead of showing a
            // white placeholder circle.
            priority
          />
        ) : (
          <span className="text-xs font-semibold text-gray-400">
            {sideLabel}
          </span>
        )}
      </div>
      {name && (
        <span className="line-clamp-2 max-w-[140px] text-xs font-bold uppercase tracking-wide text-white drop-shadow-md sm:text-sm md:max-w-[200px] md:text-base">
          {name}
        </span>
      )}
    </div>
  )
}

function ImageHero({ event, category, location }) {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        {event.image ? (
          <Image
            src={event.image}
            alt={event.title}
            className="h-full w-full object-cover"
            // LCP element on every event detail page — fetch with
            // high priority so the hero paints as fast as possible.
            priority
          />
        ) : (
          // Brand-blue fallback if there's no provider image at all.
          <div className="h-full w-full bg-gradient-to-br from-blue-600 to-blue-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/30" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-20">
        <span className="inline-block rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur">
          {category}
        </span>

        <h1 className="mt-4 text-3xl font-bold leading-tight text-white drop-shadow-md md:text-5xl">
          {event.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-100 md:text-base">
          {event.date && (
            <span className="flex items-center gap-2">
              <span aria-hidden>📅</span>
              {event.date}
            </span>
          )}
          {location && (
            <span className="flex items-center gap-2">
              <span aria-hidden>📍</span>
              {location}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
