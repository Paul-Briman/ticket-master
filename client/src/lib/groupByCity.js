import { toSlug } from './slug.js'

// All events the API returns are upcoming (the backend filters past
// fixtures via isUpcomingIso during normalization), so any event we
// receive here is by definition upcoming and successfully normalized.
function pickSlug(event) {
  if (!event) return ''
  if (event.citySlug) return event.citySlug
  if (event.city) return toSlug(event.city)
  return ''
}

/**
 * Group events by city slug. Pure function — no Vite/React imports —
 * so tests can call it directly. Takes any number of bucket arrays:
 *
 *   - dedupes by `event.id`
 *   - drops anything without a resolvable city slug
 *   - returns { byCity: Record<slug, Event[]>, allEvents: Event[] }
 */
export function groupEventsByCity(...buckets) {
  const byCity = {}
  const allEvents = []
  const seen = new Set()
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue
    for (const event of bucket) {
      if (!event?.id || seen.has(event.id)) continue
      seen.add(event.id)
      allEvents.push(event)
      const slug = pickSlug(event)
      if (!slug) continue
      if (!byCity[slug]) byCity[slug] = []
      byCity[slug].push(event)
    }
  }
  return { byCity, allEvents }
}
