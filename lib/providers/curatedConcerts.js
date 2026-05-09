// Curated concerts adapter — premium internal dataset matching the
// normalized event model. Swappable later with a real concert API
// (Bandsintown / Songkick / etc.) without touching the route or
// frontend code.

import { EVENTS } from '../../client/src/data/events.js'
import { normalizeEvent } from './normalize.js'

export const PROVIDER_NAME = 'curated-concerts'

function toNormalized(e) {
  return normalizeEvent({
    id: e.id,
    providerId: e.id, // curated catalog has no separate provider id
    title: e.title,
    category: 'concerts',
    sport: null,
    league: null,
    venue: e.venue || '',
    city: e.city || '',
    country: e.country || '',
    image: e.image,
    date: e.date, // pre-formatted display string
    utcDate: null,
    price: e.price, // preserve curated price
    badge: e.badge || null,
    badgeType: e.badgeType || null,
    provider: PROVIDER_NAME,
  })
}

export async function fetchAll({ limit = 25 } = {}) {
  const events = EVENTS.filter((e) => e.category === 'concerts')
    .map(toNormalized)
    .filter(Boolean)
  console.log(`[curated-concerts] returning ${events.length} concerts`)
  return {
    events: events.slice(0, limit),
    status: events.length > 0 ? 'ok' : 'empty',
    providerStatus: 'ok',
    count: events.length,
  }
}
