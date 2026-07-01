// Merge admin overrides onto a live or curated event. Overrides take
// precedence on every field they specify. The result still passes the
// normalized event contract (id stays stable, providerId stays stable).

import { parseDisplayDateToMs } from '../util/eventExpiry.js'

const OVERRIDABLE_FIELDS = [
  'title',
  'image',
  'venue',
  'city',
  'country',
  'date',
  // utcDate is overridable so the admin's date edit is authoritative
  // for the expiry filter. Without this, a base event with a stale
  // (future) utcDate would shadow the override's (earlier/later)
  // display date at getEventStartMs, letting a past-dated overridden
  // event stay visible on public pages — the "original mock event
  // resurfacing" symptom the spec calls out.
  'utcDate',
  'price',
  'badge',
  'badgeType',
]

// Fields the DB snapshot can backfill onto a live event when the live
// response is missing them. Live wins when present; snapshot only fills
// gaps. Pricing is handled separately as a tier-by-tier merge.
export const SNAPSHOT_BACKFILL_FIELDS = [
  'title',
  'venue',
  'city',
  'citySlug',
  'country',
  'image',
  'date',
  'utcDate',
  'homeTeam',
  'awayTeam',
  'homeCrest',
  'awayCrest',
  'price',
  'badge',
  'badgeType',
  'category',
  'sport',
  'league',
  'provider',
  'providerId',
]

/**
 * Merge a DB snapshot onto a live event. The live event is the base —
 * snapshot only fills fields the live response left empty. This lets
 * the admin form (and any DB-first read path) survive a provider
 * regression where a previously-populated field temporarily disappears.
 */
export function mergeWithSnapshot(live, snapshot) {
  if (!snapshot) return live
  if (!live) return snapshot
  const merged = { ...live }
  for (const field of SNAPSHOT_BACKFILL_FIELDS) {
    const liveVal = live[field]
    const snapVal = snapshot[field]
    const liveEmpty =
      liveVal === '' || liveVal === null || liveVal === undefined
    if (liveEmpty && snapVal != null && snapVal !== '') {
      merged[field] = snapVal
    }
  }
  // Pricing tiers — live wins per-tier, snapshot fills any missing tier.
  const livePricing = live.pricing || {}
  const snapPricing = snapshot.pricing || {}
  merged.pricing = {
    standard: livePricing.standard ?? snapPricing.standard,
    premium: livePricing.premium ?? snapPricing.premium,
    vip: livePricing.vip ?? snapPricing.vip,
  }
  return merged
}

export function applyEventOverride(event, override) {
  if (!event) return event
  if (!override) return event

  const merged = { ...event }
  for (const field of OVERRIDABLE_FIELDS) {
    if (override[field] !== undefined && override[field] !== null && override[field] !== '') {
      merged[field] = override[field]
    }
  }

  // Date/utcDate sync — when the admin edits the display `date` but
  // doesn't explicitly send a new utcDate, derive utcDate from the
  // new display date. Without this, the base's utcDate would stay
  // authoritative for expiry checks (getEventStartMs prefers utcDate
  // over date), causing an "overridden to July 2026" event to stay
  // visible until the base's original January 2027 date arrived —
  // or worse, remain buyable past its true showtime.
  //
  // Only overwrite when the OVERRIDE actually changed the display
  // date AND didn't explicitly provide its own utcDate.
  const overrideDateChanged =
    override.date !== undefined &&
    override.date !== null &&
    override.date !== '' &&
    override.date !== event.date
  const overrideHasUtc =
    override.utcDate !== undefined &&
    override.utcDate !== null &&
    override.utcDate !== ''
  if (overrideDateChanged && !overrideHasUtc) {
    const parsed = parseDisplayDateToMs(override.date)
    if (parsed !== null) {
      merged.utcDate = new Date(parsed).toISOString()
    } else {
      // Unparseable display string → clear utcDate so the expiry
      // filter falls back to parsing merged.date directly (which
      // matches what a viewer would see on the page). Preserving the
      // stale utcDate here would be worse than dropping it.
      delete merged.utcDate
    }
  }

  // Pricing is a nested object — merge tier-by-tier so partial admin
  // edits don't blow away unchanged tiers.
  if (override.pricing && typeof override.pricing === 'object') {
    merged.pricing = {
      ...(event.pricing || {}),
      ...override.pricing,
    }
    // Update top-level price string to reflect new standard tier.
    if (override.pricing.standard != null) {
      merged.price = `$${override.pricing.standard}`
    }
  }

  if (event.citySlug && override.city) {
    // citySlug auto-recomputes if city changed
    merged.citySlug = override.city
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  merged.adminEdited = true
  return merged
}

export function applyOverridesToList(events, overridesMap) {
  if (!events?.length) return events || []
  if (!overridesMap || Object.keys(overridesMap).length === 0) return events
  return events.map((e) =>
    overridesMap[e.id] ? applyEventOverride(e, overridesMap[e.id]) : e,
  )
}

/**
 * Filter admin-created events down to those that belong on a category
 * list (e.g. /api/concerts), and optionally a specific league. Sports
 * list endpoints pass `league` to scope to e.g. NBA only; non-sports
 * endpoints leave league undefined.
 */
export function filterAdminEventsForCategory(adminEvents, category, league) {
  if (!Array.isArray(adminEvents) || adminEvents.length === 0) return []
  return adminEvents.filter((e) => {
    if (!e || e.category !== category) return false
    if (league && e.league && e.league !== league) return false
    if (league && !e.league) return false
    return true
  })
}
