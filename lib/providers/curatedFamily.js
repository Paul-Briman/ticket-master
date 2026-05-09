// Curated family events adapter — premium internal dataset.

import { EVENTS } from '../../client/src/data/events.js'
import { normalizeEvent } from './normalize.js'

export const PROVIDER_NAME = 'curated-family'

function toNormalized(e) {
  return normalizeEvent({
    id: e.id,
    providerId: e.id,
    title: e.title,
    category: 'family',
    sport: null,
    league: null,
    venue: e.venue || '',
    city: e.city || '',
    country: e.country || '',
    image: e.image,
    date: e.date,
    utcDate: null,
    price: e.price,
    badge: e.badge || null,
    badgeType: e.badgeType || null,
    provider: PROVIDER_NAME,
  })
}

export async function fetchAll({ limit = 25 } = {}) {
  const events = EVENTS.filter((e) => e.category === 'family')
    .map(toNormalized)
    .filter(Boolean)
  console.log(`[curated-family] returning ${events.length} family events`)
  return {
    events: events.slice(0, limit),
    status: events.length > 0 ? 'ok' : 'empty',
    providerStatus: 'ok',
    count: events.length,
  }
}
