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

// Sort helper: within a given section's event pool, events with
// featured=true AND featuredSection===sectionKey rise to the top.
// featuredOrder ascending (numeric) controls their internal order;
// featured items without a numeric featuredOrder appear after those
// with one, but still ahead of every non-featured event. Non-featured
// events keep the natural order the caller already sorted them into.
// When no event is featured for the section, output === input (fall-
// back to automatic behavior — homepage never appears empty).
function sortFeaturedFirst(events, sectionKey) {
  if (!Array.isArray(events) || events.length === 0) return events
  const featured = []
  const other = []
  for (const e of events) {
    if (e?.featured === true && e?.featuredSection === sectionKey) {
      featured.push(e)
    } else {
      other.push(e)
    }
  }
  if (featured.length === 0) return events
  featured.sort((a, b) => {
    const ao = Number(a?.featuredOrder)
    const bo = Number(b?.featuredOrder)
    const aHas = Number.isFinite(ao)
    const bHas = Number.isFinite(bo)
    if (aHas && bHas) return ao - bo
    if (aHas) return -1
    if (bHas) return 1
    return 0 // both unordered — preserve incoming relative order
  })
  return [...featured, ...other]
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

    switch (cfg.key) {
      case 'world-cup-knockout': {
        const events = sortFeaturedFirst(
          sportsByLeague.byLeague['world-cup'] || [],
          cfg.key,
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
        const events = sortFeaturedFirst(
          sportsByLeague.byLeague.ucl || [],
          cfg.key,
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
        const events = sortFeaturedFirst(
          sportsByLeague.byLeague.nba || [],
          cfg.key,
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
        const events = sortFeaturedFirst(featuredSportsEvents, cfg.key)
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
        return (
          <LiveEventsSection
            key={cfg.key}
            category={cfg.key}
            title={meta.title}
            subtitle={meta.subtitle}
            seeAllHref={meta.seeAllHref}
            // Fetch exactly what we'll render so we don't over-fetch
            // when the admin has reduced the limit. size is passed
            // through to /api/{category}?size=…
            size={limit}
            // Pin admin-featured events at the top of the lane.
            // LiveEventsSection knows to apply sortFeaturedFirst
            // internally when featuredSectionKey is provided.
            featuredSectionKey={cfg.key}
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
