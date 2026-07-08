import { useMemo } from 'react'
import Hero from '../components/Hero.jsx'
import Section from '../components/Section.jsx'
import EventCard from '../components/EventCard.jsx'
import CardScroller from '../components/CardScroller.jsx'
import LiveSportsSection from '../components/LiveSportsSection.jsx'
import LiveEventsSection from '../components/LiveEventsSection.jsx'
import HomePromotionBanner from '../components/HomePromotionBanner.jsx'
import { CityFeatureCard } from '../components/CityCard.jsx'
import LeagueCard from '../components/sports/LeagueCard.jsx'
import { POPULAR_US_CITIES } from '../data/cities.js'
import { SPORTS_LEAGUES } from '../data/leagues.js'
import { useRecentlyViewed } from '../lib/recentlyViewed.js'
import { useCityEvents } from '../lib/useCityEvents.js'
import { useAllSportsEvents } from '../lib/useAllSportsEvents.js'
import {
  useHomepageSections,
  SECTION_META,
} from '../lib/useHomepageSections.js'
import { useHomepageFeatured } from '../lib/useHomepageFeatured.js'

// Slots that share the sports data layer. Featured Sports's dedup
// contract explicitly excludes any league whose dedicated lane is
// enabled — even if that lane is truncated by its display limit,
// remaining events belong under the lane's "See All" link, not on
// the homepage a second time.
const DEDICATED_SPORTS_LEAGUES = {
  'world-cup-knockout': 'world-cup',
  ucl: 'ucl',
  nba: 'nba',
}

// Merge rule per the spec:
//   · Featured events for this section come FIRST, sorted by numeric
//     featuredOrder ascending (unordered entries after ordered ones).
//   · The natural (automatic) pool comes after, minus any event id
//     already present in the featured prefix (no duplicates).
//   · Downstream, LiveSportsSection / LiveEventsSection slices to the
//     admin's Homepage Display Limit — so H is naturally pushed off
//     the end when the prefix grows.
//
// Automatic selection logic itself is untouched — this helper never
// looks at or filters the natural pool, only prepends featured to it.
// If `featuredForSection` is empty, output is the natural pool
// unchanged (automatic fallback).
function mergeFeaturedThenNatural(featuredForSection, naturalPool) {
  const natural = Array.isArray(naturalPool) ? naturalPool : []
  if (!Array.isArray(featuredForSection) || featuredForSection.length === 0) {
    return natural
  }
  const sorted = featuredForSection.slice().sort((a, b) => {
    const ao = Number(a?.featuredOrder)
    const bo = Number(b?.featuredOrder)
    const aHas = Number.isFinite(ao)
    const bHas = Number.isFinite(bo)
    if (aHas && bHas) return ao - bo
    if (aHas) return -1
    if (bHas) return 1
    return 0
  })
  const featuredIds = new Set(sorted.map((e) => e?.id).filter(Boolean))
  const dedupedNatural = natural.filter((e) => e?.id && !featuredIds.has(e.id))
  return [...sorted, ...dedupedNatural]
}

export default function Home() {
  const { recent } = useRecentlyViewed()
  const recentEvents = recent
  const { byCity, loading: citiesLoading } = useCityEvents()

  // Single source of truth for every sports section on this page.
  // Same per-league cache used by /sports and the League page so a
  // card count and the page it links to can never disagree.
  const sportsByLeague = useAllSportsEvents()

  // Admin-controlled section config. Falls back gracefully to the
  // built-in defaults before the API resolves — never renders blank.
  const { sections } = useHomepageSections()

  // Global featured pool — every event currently marked featured=true
  // regardless of category / league / natural fetch position. Used
  // per-section to check "is there any featured event for THIS lane?"
  // and, if so, populate the lane with ONLY those (spec).
  const { events: featuredPool } = useHomepageFeatured()

  const featuredBySection = useMemo(() => {
    const bucket = {}
    for (const e of featuredPool) {
      if (e?.featured !== true) continue
      const key = e.featuredSection
      if (!key) continue
      if (!bucket[key]) bucket[key] = []
      bucket[key].push(e)
    }
    return bucket
  }, [featuredPool])

  // Precompute the featured-sports event pool so the Section builder
  // doesn't have to loop nested. Excludes every league that owns a
  // dedicated enabled lane on this homepage config.
  const featuredSportsEvents = useMemo(() => {
    const enabledDedicatedLeagues = new Set()
    for (const cfg of sections) {
      if (!cfg.enabled) continue
      const league = DEDICATED_SPORTS_LEAGUES[cfg.key]
      if (league) enabledDedicatedLeagues.add(league)
    }
    return sportsByLeague.allEvents.filter(
      (e) => !enabledDedicatedLeagues.has(e.league),
    )
  }, [sections, sportsByLeague.allEvents])

  // Render each admin-enabled section in the configured order. Empty
  // sections are auto-hidden by the LiveSportsSection /
  // LiveEventsSection hideWhenEmpty prop so the layout closes gaps.
  function renderSection(cfg) {
    if (!cfg.enabled) return null
    const meta = SECTION_META[cfg.key]
    if (!meta) return null
    const limit = Number.isFinite(cfg.limit) ? cfg.limit : 8

    const featuredForThis = featuredBySection[cfg.key] || []

    switch (cfg.key) {
      case 'world-cup-knockout': {
        const events = mergeFeaturedThenNatural(
          featuredForThis,
          sportsByLeague.byLeague['world-cup'] || [],
        )
        return (
          <LiveSportsSection
            key={cfg.key}
            title={meta.title}
            subtitle={meta.subtitle}
            seeAllHref={meta.seeAllHref}
            events={events}
            loading={sportsByLeague.loading}
            displaySize={limit}
            hideWhenEmpty
          />
        )
      }
      case 'ucl': {
        const events = mergeFeaturedThenNatural(
          featuredForThis,
          sportsByLeague.byLeague.ucl || [],
        )
        return (
          <LiveSportsSection
            key={cfg.key}
            title={meta.title}
            subtitle={meta.subtitle}
            seeAllHref={meta.seeAllHref}
            events={events}
            loading={sportsByLeague.loading}
            displaySize={limit}
            hideWhenEmpty
          />
        )
      }
      case 'nba': {
        const events = mergeFeaturedThenNatural(
          featuredForThis,
          sportsByLeague.byLeague.nba || [],
        )
        return (
          <LiveSportsSection
            key={cfg.key}
            title={meta.title}
            subtitle={meta.subtitle}
            seeAllHref={meta.seeAllHref}
            events={events}
            loading={sportsByLeague.loading}
            displaySize={limit}
            hideWhenEmpty
          />
        )
      }
      case 'featured-sports': {
        const events = mergeFeaturedThenNatural(
          featuredForThis,
          featuredSportsEvents,
        )
        return (
          <LiveSportsSection
            key={cfg.key}
            title={meta.title}
            subtitle={meta.subtitle}
            seeAllHref={meta.seeAllHref}
            events={events}
            loading={sportsByLeague.loading}
            displaySize={limit}
            background="gray"
            hideWhenEmpty
          />
        )
      }
      case 'concerts':
      case 'arts':
      case 'family': {
        // LiveEventsSection owns the natural per-category fetch
        // (useEventList under the hood). We pass any admin-featured
        // events for this lane via `prependEvents`; the component
        // dedupes them out of its natural pool and prepends. The
        // existing `size` slice still applies — H rolls off the end
        // once X is inserted at the top.
        return (
          <LiveEventsSection
            key={cfg.key}
            category={cfg.key}
            title={meta.title}
            subtitle={meta.subtitle}
            seeAllHref={meta.seeAllHref}
            size={limit}
            prependEvents={featuredForThis}
            hideWhenEmpty
          />
        )
      }
      default:
        return null
    }
  }

  // Build the ordered list of rendered sections. Filter nulls (from
  // disabled or unknown keys) BEFORE assigning alternating backgrounds
  // so the visual rhythm stays consistent even after the admin toggles
  // a section off.
  const orderedSections = sections
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((cfg) => renderSection(cfg))
    .filter(Boolean)

  return (
    <div className="flex flex-col">
      <Hero />

      {/* Featured promotion banner — renders nothing when no
          campaign is currently active+featured, vanishes when its
          countdown hits zero. */}
      <HomePromotionBanner />

      {recentEvents.length > 0 && (
        <Section
          title="Recently Viewed"
          subtitle="Pick up where you left off."
          background="gray"
        >
          <CardScroller>
            {recentEvents.map((event) => (
              <EventCard key={event.id} {...event} />
            ))}
          </CardScroller>
        </Section>
      )}

      {/* Anchor target for the Hero "Browse Matches" CTA — kept just
          before the sports lanes so smooth-scroll lands under the
          navbar into the first admin-visible section. */}
      <div id="matches-section" className="scroll-mt-24 md:scroll-mt-28" />

      {/* Admin-controlled sections rendered in the saved order. Each
          one auto-hides if it has zero upcoming events. */}
      {orderedSections}

      {/* League grid + Popular cities remain fixed navigation aids —
          intentionally NOT part of the admin sections config because
          they're browse-affordances, not event lanes. */}
      <Section
        title="Browse Sports by League"
        subtitle="Pick your league — from the World Cup and UCL to the NBA, NFL, F1, UFC, and more."
        seeAllHref="/sports"
        background="gray"
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {SPORTS_LEAGUES.map((league, idx) => (
            <LeagueCard
              key={league.key}
              league={league}
              lock={500 + idx}
              count={sportsByLeague.counts[league.key]}
              loading={sportsByLeague.loading}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Popular Cities"
        subtitle="Find events in top cities across the United States."
        seeAllHref="/cities"
        background="gray"
      >
        <CardScroller>
          {POPULAR_US_CITIES.map((city) => (
            <CityFeatureCard
              key={city.slug}
              {...city}
              count={byCity[city.slug]?.length ?? 0}
              loading={citiesLoading}
            />
          ))}
        </CardScroller>
      </Section>
    </div>
  )
}
