// Shared helpers for adapter implementations: normalized event factory,
// deterministic price synthesis, slug, date formatting, etc.

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const PRICE_RANGES = {
  sports: [60, 380],
  concerts: [85, 285],
  arts: [70, 220],
  family: [25, 95],
}

export function simpleHash(input) {
  let h = 0
  const s = String(input || '')
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function synthPrice(seed, category = 'sports') {
  const [min, max] = PRICE_RANGES[category] || PRICE_RANGES.sports
  return min + (simpleHash(seed) % (max - min + 1))
}

export function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Format an ISO timestamp (UTC) into a human display string in the user's
// natural reading order. We deliberately render in UTC since we don't know
// the venue's true timezone for many providers.
export function formatDateFromIso(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  let h = date.getUTCHours()
  const m = String(date.getUTCMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${DAYS[date.getUTCDay()]}, ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()} \u00B7 ${h}:${m} ${ampm}`
}

// True if the event is upcoming or in-progress (within ~6 hours of start).
// `iso` is the canonical UTC timestamp.
export function isUpcomingIso(iso) {
  if (!iso) return false
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return false
  return ms + 6 * 3600 * 1000 >= Date.now()
}

/**
 * Build a normalized event object that is provider-agnostic.
 *
 * Frontend MUST only use these fields. Provider-specific fields belong in
 * `raw` and should never leak to the UI.
 */
export function normalizeEvent({
  id,                  // prefixed external id, e.g. "sdb-2469469", "fd-12345"
  providerId,           // raw provider id WITHOUT prefix, e.g. "2469469"
  title,
  category,
  sport = null,
  league = null,
  venue = '',
  city = '',
  country = '',
  image = null,
  homeTeam = null,
  awayTeam = null,
  homeCrest = null,
  awayCrest = null,
  utcDate = null,
  date = null,         // display string override (use when no ISO timestamp)
  price = null,        // explicit override; otherwise synthesized
  badge = null,
  badgeType = null,
  provider,
  raw,
}) {
  if (!id || !title || !category || !provider) return null
  if (utcDate && !isUpcomingIso(utcDate)) return null

  const event = {
    id,
    providerId: providerId != null ? String(providerId) : null,
    title,
    category,
    sport,
    league,
    venue,
    city,
    citySlug: slugify(city),
    country,
    image,
    homeTeam,
    awayTeam,
    homeCrest,
    awayCrest,
    date: date || (utcDate ? formatDateFromIso(utcDate) : ''),
    utcDate,
    price: price || `$${synthPrice(id, category)}`,
    badge,
    badgeType,
    provider,
  }
  if (raw) event._raw = raw // never sent to frontend, just for debug
  return event
}

export function dedupeAndSortByDate(events) {
  const seen = new Set()
  const out = []
  for (const e of events) {
    if (!e || seen.has(e.id)) continue
    seen.add(e.id)
    out.push(e)
  }
  out.sort((a, b) => {
    const aMs = a.utcDate ? Date.parse(a.utcDate) : 0
    const bMs = b.utcDate ? Date.parse(b.utcDate) : 0
    return (aMs || 0) - (bMs || 0)
  })
  return out
}
