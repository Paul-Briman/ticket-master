// Promotion engine — pure decoration layer that runs LAST in the
// read path. It never mutates the provider/normalize/override output;
// it only adds a `promotion` field to the event when an active
// promotion matches the event's scope.
//
// Layering recap:
//   provider → normalize → snapshot/override merge → expiry filter →
//   applyPromotions ← here ← list/detail response
//
// Status is DERIVED at request time from enabled + startsAt + endsAt
// + the current clock, so there is no separate "expire" cron — the
// instant `endsAt` passes the promo simply stops matching and the
// next API call returns the base prices.

const STATUS = Object.freeze({
  ACTIVE: 'active',
  SCHEDULED: 'scheduled',
  EXPIRED: 'expired',
  DISABLED: 'disabled',
})

const DISCOUNT_TYPES = Object.freeze(['percentage', 'fixed'])
const SCOPES = Object.freeze(['all', 'category', 'league', 'events'])
const CATEGORIES = Object.freeze(['sports', 'concerts', 'arts', 'family'])

export const PROMOTION_STATUS = STATUS

/**
 * Derive a promotion's runtime status from its persisted fields.
 * - disabled → admin manually toggled off
 * - scheduled → enabled, but startsAt is in the future
 * - active → enabled, within the start/end window
 * - expired → enabled, past endsAt
 */
export function derivePromotionStatus(promotion, now = Date.now()) {
  if (!promotion) return STATUS.EXPIRED
  if (promotion.enabled === false) return STATUS.DISABLED
  const startsMs = Date.parse(promotion.startsAt || '')
  const endsMs = Date.parse(promotion.endsAt || '')
  if (!Number.isFinite(startsMs) || !Number.isFinite(endsMs)) {
    return STATUS.EXPIRED
  }
  if (now < startsMs) return STATUS.SCHEDULED
  if (now > endsMs) return STATUS.EXPIRED
  return STATUS.ACTIVE
}

/**
 * Does this promotion's `appliesTo` clause match this event?
 *
 * appliesTo shape:
 *   { scope: 'all' }                              → matches every event
 *   { scope: 'category', category: 'sports' }     → matches sports events
 *   { scope: 'league',   league: 'world-cup' }    → matches WC events
 *   { scope: 'events',   eventIds: ['id1','id2'] } → specific events only
 */
export function promotionMatchesEvent(promotion, event) {
  if (!promotion || !event) return false
  const at = promotion.appliesTo || { scope: 'all' }
  switch (at.scope) {
    case 'all':
      return true
    case 'category':
      return !!at.category && event.category === at.category
    case 'league':
      return !!at.league && event.league === at.league
    case 'events':
      return Array.isArray(at.eventIds) && at.eventIds.includes(event.id)
    default:
      return false
  }
}

/** Discount a single price. Always returns a 2-decimal number ≥ 0. */
export function applyDiscount(price, discountType, discountValue) {
  const base = Number(price) || 0
  if (base <= 0) return 0
  let discounted = base
  if (discountType === 'percentage') {
    const pct = Math.max(0, Math.min(100, Number(discountValue) || 0))
    discounted = base * (1 - pct / 100)
  } else if (discountType === 'fixed') {
    const amt = Math.max(0, Number(discountValue) || 0)
    discounted = base - amt
  }
  return Math.max(0, Math.round(discounted * 100) / 100)
}

/** Apply the promo's discount to every tier in the pricing object. */
export function computeDiscountedPricing(pricing, promotion) {
  if (!pricing || !promotion) return null
  const out = {}
  for (const tier of Object.keys(pricing)) {
    out[tier] = applyDiscount(pricing[tier], promotion.discountType, promotion.discountValue)
  }
  return out
}

/**
 * Pick the BEST promotion for the customer when multiple active
 * promotions match. "Best" = lowest resulting price on the standard
 * tier (or the first tier if standard isn't present).
 */
function pickBestPromotion(matches, basePricing) {
  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0]
  const referenceTier =
    basePricing && 'standard' in basePricing
      ? 'standard'
      : Object.keys(basePricing || {})[0]
  if (!referenceTier) return matches[0]
  const base = Number(basePricing[referenceTier]) || 0
  let bestPromo = matches[0]
  let bestPrice = applyDiscount(base, bestPromo.discountType, bestPromo.discountValue)
  for (let i = 1; i < matches.length; i += 1) {
    const p = matches[i]
    const price = applyDiscount(base, p.discountType, p.discountValue)
    if (price < bestPrice) {
      bestPrice = price
      bestPromo = p
    }
  }
  return bestPromo
}

/**
 * Decorate one event with a `promotion` field if any active promo
 * applies. Returns the event unchanged if none matches.
 *
 * Output shape when a promo is active:
 *   event.promotion = {
 *     id, name, discountType, discountValue,
 *     startsAt, endsAt,
 *     discountedPricing: { standard, premium, vip },
 *   }
 *
 * Base pricing on `event.pricing` is NEVER overwritten. The
 * `event.price` "starting from" string is updated to reflect the
 * discounted standard price so every UI that shows "from $X" reads
 * the right number even without knowing about promotions.
 */
export function applyPromotionsToEvent(event, promotions, now = Date.now()) {
  if (!event) return event
  if (!Array.isArray(promotions) || promotions.length === 0) return event

  const candidates = []
  for (const p of promotions) {
    if (derivePromotionStatus(p, now) !== STATUS.ACTIVE) continue
    if (!promotionMatchesEvent(p, event)) continue
    candidates.push(p)
  }
  if (candidates.length === 0) return event

  const chosen = pickBestPromotion(candidates, event.pricing)
  if (!chosen) return event
  const discountedPricing = computeDiscountedPricing(event.pricing, chosen)

  // "Starting from" display string — uses the lowest of standard/premium/vip
  // after discount, matching how event.price is computed upstream.
  const tierValues = Object.values(discountedPricing || {}).filter(
    (v) => Number.isFinite(v) && v > 0,
  )
  const lowest = tierValues.length > 0 ? Math.min(...tierValues) : null

  return {
    ...event,
    // Update the "starting from" string so any legacy UI that doesn't
    // know about promotions still shows the discounted price.
    price: lowest !== null ? `From $${lowest.toFixed(0)}` : event.price,
    promotion: {
      id: chosen.id,
      name: chosen.name,
      discountType: chosen.discountType,
      discountValue: chosen.discountValue,
      startsAt: chosen.startsAt,
      endsAt: chosen.endsAt,
      discountedPricing,
    },
  }
}

/** Convenience: decorate a whole list. */
export function applyPromotionsToList(events, promotions, now = Date.now()) {
  if (!Array.isArray(events)) return []
  if (!Array.isArray(promotions) || promotions.length === 0) return events
  return events.map((e) => applyPromotionsToEvent(e, promotions, now))
}

/**
 * Validate a promotion payload before writing it to KV. Returns
 * { ok: true, promotion } with normalized fields, or
 * { ok: false, error } describing the problem.
 *
 * Used by the admin POST/PATCH endpoints.
 */
export function normalizePromotionInput(input, existing = null) {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Promotion payload is required.' }
  }
  const name = String(input.name || '').trim()
  if (!name) return { ok: false, error: 'Promotion name is required.' }
  if (name.length > 120) return { ok: false, error: 'Promotion name is too long.' }

  const discountType = String(input.discountType || '').trim()
  if (!DISCOUNT_TYPES.includes(discountType)) {
    return { ok: false, error: 'Discount type must be "percentage" or "fixed".' }
  }
  const discountValue = Number(input.discountValue)
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return { ok: false, error: 'Discount value must be a positive number.' }
  }
  if (discountType === 'percentage' && discountValue > 100) {
    return { ok: false, error: 'Percentage discount cannot exceed 100.' }
  }

  const startsMs = Date.parse(String(input.startsAt || ''))
  const endsMs = Date.parse(String(input.endsAt || ''))
  if (!Number.isFinite(startsMs)) {
    return { ok: false, error: 'startsAt must be a valid ISO date.' }
  }
  if (!Number.isFinite(endsMs)) {
    return { ok: false, error: 'endsAt must be a valid ISO date.' }
  }
  if (endsMs <= startsMs) {
    return { ok: false, error: 'endsAt must be after startsAt.' }
  }

  const at = input.appliesTo || { scope: 'all' }
  const scope = String(at.scope || 'all')
  if (!SCOPES.includes(scope)) {
    return { ok: false, error: `appliesTo.scope must be one of ${SCOPES.join(', ')}.` }
  }
  const appliesTo = { scope }
  if (scope === 'category') {
    if (!CATEGORIES.includes(at.category)) {
      return { ok: false, error: `appliesTo.category must be one of ${CATEGORIES.join(', ')}.` }
    }
    appliesTo.category = at.category
  } else if (scope === 'league') {
    const league = String(at.league || '').trim()
    if (!league) return { ok: false, error: 'appliesTo.league is required for league scope.' }
    appliesTo.league = league
  } else if (scope === 'events') {
    if (!Array.isArray(at.eventIds) || at.eventIds.length === 0) {
      return { ok: false, error: 'appliesTo.eventIds must be a non-empty array for events scope.' }
    }
    appliesTo.eventIds = at.eventIds.map((id) => String(id)).filter(Boolean)
  }

  const enabled = input.enabled === false ? false : true

  const now = new Date().toISOString()
  const promotion = {
    id: existing?.id || `prm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    discountType,
    discountValue,
    startsAt: new Date(startsMs).toISOString(),
    endsAt: new Date(endsMs).toISOString(),
    enabled,
    appliesTo,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }
  return { ok: true, promotion }
}

/**
 * Build the default seed promotion (World Cup Knockout Sale, 20% off,
 * scoped to the world-cup league). The lazy seeder in db.js calls
 * this once when the promotions namespace is empty AND the
 * tm:promotions-seeded marker is missing.
 */
export function defaultWorldCupPromotion(now = new Date()) {
  const startsAt = now.toISOString()
  const endsAt = new Date(now.getTime() + 30 * 86400000).toISOString() // 30 days
  return {
    id: 'prm-world-cup-knockout',
    name: 'World Cup Knockout Sale',
    discountType: 'percentage',
    discountValue: 20,
    startsAt,
    endsAt,
    enabled: true,
    appliesTo: { scope: 'league', league: 'world-cup' },
    createdAt: startsAt,
    updatedAt: startsAt,
  }
}
