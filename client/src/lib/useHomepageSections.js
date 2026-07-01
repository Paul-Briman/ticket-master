import { useEffect, useState } from 'react'
import { api } from './api.js'

// Module-level cache so the Home page and the AdminHomepageSections
// page share the same config without duplicate fetches. After the
// admin saves a change, both re-fetch — the cache is intentionally
// mutable, not stale-while-revalidate.
let cached = null
let inflight = null

// The frontend-side default config. Used only as a fallback when the
// API hasn't returned yet — the backend always seeds a persisted copy
// on first request, so this list should only fire on first paint of
// a cold cache. Order matters (renders top-to-bottom); admin edits
// override this at the backend level.
const FALLBACK = [
  { key: 'world-cup-knockout', enabled: true, limit: 8, order: 0 },
  { key: 'ucl', enabled: true, limit: 8, order: 1 },
  { key: 'nba', enabled: true, limit: 8, order: 2 },
  { key: 'featured-sports', enabled: true, limit: 8, order: 3 },
  { key: 'concerts', enabled: true, limit: 8, order: 4 },
  { key: 'arts', enabled: true, limit: 8, order: 5 },
  { key: 'family', enabled: true, limit: 8, order: 6 },
]

// Display metadata that lives on the frontend. The backend only
// stores { key, enabled, limit, order }; everything visual — the
// title, the "See All" href, the subtitle — is a client-side
// constant so admins can't accidentally break section identity by
// renaming a key mid-flight.
export const SECTION_META = {
  'world-cup-knockout': {
    title: 'Knockout World Cup Matches',
    subtitle: 'Upcoming FIFA World Cup fixtures.',
    seeAllHref: '/sports/world-cup',
  },
  ucl: {
    title: 'Champions League',
    subtitle: 'UEFA Champions League fixtures.',
    seeAllHref: '/sports/ucl',
  },
  nba: {
    title: 'NBA Matchups',
    subtitle: 'Upcoming NBA games.',
    seeAllHref: '/sports/nba',
  },
  'featured-sports': {
    title: 'Featured Sports',
    subtitle:
      'UFC, boxing, tennis, F1, MotoGP, MLB, NFL, and other upcoming events.',
    seeAllHref: '/sports',
  },
  concerts: {
    title: 'Trending Concerts',
    subtitle: 'Upcoming tour dates from artists fans are following most.',
    seeAllHref: '/concerts',
  },
  arts: {
    title: 'Arts & Theater',
    subtitle:
      'Broadway productions, comedy nights, opera, and live performances.',
    seeAllHref: '/arts',
  },
  family: {
    title: 'Family Events',
    subtitle: 'Disney-style experiences, ice shows, circus, and more.',
    seeAllHref: '/family',
  },
}

/**
 * Fetch the homepage section config. Returns:
 *   { sections, loading }
 *
 * `sections` is always an array (falls back to FALLBACK before the
 * API resolves), ordered by admin preference, with { key, enabled,
 * limit, order }. Home.jsx renders these in array order.
 */
export function useHomepageSections() {
  const [sections, setSections] = useState(cached || FALLBACK)
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    let cancelled = false
    if (cached) {
      setSections(cached)
      setLoading(false)
      return
    }
    if (!inflight) {
      inflight = api
        .homepageSections()
        .then((res) => {
          const list = Array.isArray(res?.sections) ? res.sections : FALLBACK
          cached = list
          return list
        })
        .catch(() => FALLBACK) // network hiccup → fall back, don't blank the homepage
        .finally(() => {
          inflight = null
        })
    }
    inflight.then((list) => {
      if (cancelled) return
      setSections(list)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { sections, loading }
}

/**
 * Called from AdminHomepageSections after a successful save so the
 * homepage picks up the new config on next mount without waiting for
 * a full page refresh.
 */
export function invalidateHomepageSectionsCache(newSections) {
  cached = Array.isArray(newSections) ? newSections : null
}
