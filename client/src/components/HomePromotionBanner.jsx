import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import PromotionCountdown from './PromotionCountdown.jsx'

// Slot below Hero / above the first content lane on the homepage.
// Self-fetches the currently-active featured promotion via the
// dedicated /api/promotions/featured endpoint, which returns 204 (no
// content → null) when no campaign is currently featured. So this
// component is the single switch for "do we show the homepage promo
// banner at all today?" — auto-hides when the campaign expires.
//
// CTA destination is derived from the promotion's appliesTo scope:
//   • league → `/sports/<league>` (smooth-scroll to matches lane if
//     we're already on /)
//   • category → `/sports`, `/concerts`, `/arts`, `/family`
//   • events → first event's detail page
//   • all → `/sports` (sensible default for sitewide campaigns)

export default function HomePromotionBanner() {
  const [promotion, setPromotion] = useState(null)
  const [, setLoadedAt] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await api.featuredPromotion()
        if (cancelled) return
        // The request helper returns null/empty-string for 204
        // responses, so res is one of: { promotion: {...} } | null | ''
        setPromotion(res?.promotion || null)
        setLoadedAt(Date.now())
      } catch {
        // Banner is non-essential — never block the homepage on its failure.
        if (!cancelled) setPromotion(null)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Render nothing at all when there's no active featured promo.
  // No skeleton, no placeholder, no layout shift — the homepage just
  // looks like it always has.
  if (!promotion) return null

  return (
    <PromoBannerView
      promotion={promotion}
      onExpire={() => setPromotion(null)} // when timer hits zero, vanish
    />
  )
}

function PromoBannerView({ promotion, onExpire }) {
  const ctaHref = deriveCtaHref(promotion)
  const ctaLabel = deriveCtaLabel(promotion)
  const label = formatLabel(promotion)
  // Sitewide / category banner copy adapts so it always reads naturally
  const scope = promotion.appliesTo?.scope
  const subjectText =
    scope === 'all'
      ? 'all tickets'
      : scope === 'category'
        ? `all ${promotion.appliesTo.category} tickets`
        : scope === 'league'
          ? `all ${leagueDisplayName(promotion.appliesTo.league)} tickets`
          : 'select tickets'

  function handleCtaClick(e) {
    // If the CTA is an in-page hash anchor, smooth-scroll. Otherwise
    // let the link navigate normally.
    if (ctaHref.startsWith('#')) {
      e.preventDefault()
      const id = ctaHref.slice(1)
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-br from-blue-800 via-brand to-blue-900 text-white">
      {/* Soft glow accents — keep it premium without being gaudy */}
      <div
        className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-pink-400/20 blur-3xl"
        aria-hidden
      />

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between md:gap-8">
          {/* Left: title + copy + CTA */}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur">
                Limited time
              </span>
              <span className="inline-flex items-center rounded-full bg-gradient-to-r from-red-500 to-pink-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-md">
                {label}
              </span>
            </div>

            <h2 className="text-2xl font-bold leading-tight md:text-3xl lg:text-4xl">
              <span aria-hidden className="mr-1.5">🏆</span>
              {promotion.name}
            </h2>

            <p className="text-sm text-white/85 md:text-base">
              <span className="font-semibold">{label}</span> on {subjectText} for
              a limited time. The discount is applied automatically at checkout.
            </p>

            <div className="mt-1">
              <a
                href={ctaHref}
                onClick={handleCtaClick}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-brand shadow-md transition-transform hover:-translate-y-0.5 hover:bg-blue-50 md:text-base"
              >
                {ctaLabel}
                <span aria-hidden>→</span>
              </a>
            </div>
          </div>

          {/* Right: countdown */}
          <div className="flex w-full flex-col items-start gap-3 md:w-auto md:items-end">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/70">
              Sale ends in
            </span>
            <PromotionCountdown endsAt={promotion.endsAt} onExpire={onExpire} />
          </div>
        </div>
      </div>
    </section>
  )
}

function formatLabel(promotion) {
  if (!promotion) return ''
  if (promotion.discountType === 'percentage') return `${Math.round(promotion.discountValue)}% OFF`
  if (promotion.discountType === 'fixed') return `$${Math.round(promotion.discountValue)} OFF`
  return 'SALE'
}

function deriveCtaHref(promotion) {
  const at = promotion.appliesTo || {}
  if (at.scope === 'league') {
    // If user is already on the homepage, scrolling to the in-page
    // matches lane is friendlier than a full navigation. Home.jsx
    // gives the lane id="matches-section" for the WC case.
    if (at.league === 'world-cup' && typeof window !== 'undefined' && window.location?.pathname === '/') {
      return '#matches-section'
    }
    return `/sports/${at.league}`
  }
  if (at.scope === 'category') {
    return at.category === 'sports' ? '/sports' : `/${at.category}`
  }
  if (at.scope === 'events' && Array.isArray(at.eventIds) && at.eventIds.length > 0) {
    return `/event/${at.eventIds[0]}`
  }
  return '/sports' // sitewide default — most prominent destination
}

function deriveCtaLabel(promotion) {
  const at = promotion.appliesTo || {}
  if (at.scope === 'league') {
    return `View ${leagueDisplayName(at.league)} Matches`
  }
  if (at.scope === 'category') {
    return at.category === 'sports'
      ? 'View Sports Events'
      : at.category === 'concerts'
        ? 'View Concerts'
        : at.category === 'arts'
          ? 'View Arts & Theater'
          : 'View Family Events'
  }
  if (at.scope === 'events') return 'View Event'
  return 'Browse Events'
}

function leagueDisplayName(slug) {
  switch (slug) {
    case 'world-cup': return 'World Cup'
    case 'ucl': return 'UCL'
    case 'nba': return 'NBA'
    case 'nfl': return 'NFL'
    case 'mlb': return 'MLB'
    case 'f1': return 'F1'
    case 'ufc': return 'UFC'
    case 'tennis': return 'Tennis'
    case 'boxing': return 'Boxing'
    default: return slug || ''
  }
}
