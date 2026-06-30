export function parsePrice(str) {
  if (typeof str === 'number') return str
  if (!str) return 0
  const num = Number(String(str).replace(/[^0-9.]/g, ''))
  return Number.isFinite(num) ? num : 0
}

export function formatPrice(value) {
  if (!Number.isFinite(value)) return '$0.00'
  return `$${value.toFixed(2)}`
}

export function optionLabel(option) {
  if (!option) return ''
  if (option.row === undefined || option.row === null || option.row === '') {
    return option.section
  }
  return `${option.section} \u2013 Row ${option.row}`
}

function r(base, mult) {
  return Math.round(base * mult)
}

function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h | 0)
}

function makeRng(seed) {
  let s = hash(seed) || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0
    return (s >>> 0) / 0x100000000
  }
}

function pickInRange(rand, min, max) {
  return min + Math.floor(rand() * (max - min + 1))
}

function pickUniqueRows(rand, count, low, high) {
  const available = high - low + 1
  const target = Math.min(count, available)
  const set = new Set()
  while (set.size < target) {
    set.add(pickInRange(rand, low, high))
  }
  return [...set].sort((a, b) => a - b)
}

// Row-count and row-number ranges per tier. Pricing is no longer baked
// into these configs — the admin's per-tier base price drives the actual
// numbers, and TIER_VARIANCE below controls how rows fan out around it.
const SPORTS_TIERS = [
  { tier: 'vip', tierLabel: 'VIP', section: 'VIP Section',
    countRange: [2, 4], rowRange: [1, 6] },
  { tier: 'premium', tierLabel: 'Premium', section: 'Section B',
    countRange: [3, 5], rowRange: [5, 20] },
  { tier: 'standard', tierLabel: 'Standard', section: 'Section A',
    countRange: [4, 6], rowRange: [15, 40] },
]

const CONCERT_TIERS = [
  { tier: 'vip', tierLabel: 'VIP', section: 'Front Row',
    countRange: [2, 4], rowRange: [1, 5] },
  { tier: 'premium', tierLabel: 'Premium', section: 'Floor',
    countRange: [3, 5], rowRange: [5, 15] },
  { tier: 'standard', tierLabel: 'Standard', section: 'Mezzanine',
    countRange: [4, 6], rowRange: [10, 25] },
]

const THEATER_TIERS = [
  { tier: 'vip', tierLabel: 'VIP', section: 'Orchestra',
    countRange: [2, 4], rowRange: [1, 3] },
  { tier: 'premium', tierLabel: 'Premium', section: 'Mezzanine',
    countRange: [3, 5], rowRange: [3, 10] },
  { tier: 'standard', tierLabel: 'Standard', section: 'Balcony',
    countRange: [4, 6], rowRange: [8, 18] },
]

// Row-level price variation around each tier's admin-set base price.
//   top:    multiplier at row 1 (closest / front-most row in tier)
//   bottom: multiplier at the last row of the tier
//
// VIP fans out the most: row 1 sells for +5–10% over base, descending
// gradually to ~5% below base by the back of the VIP block.
// Premium hovers at ±5% around its base.
// Standard never goes UP — it only varies downward (mild discount on
// back rows). This guarantees a Standard row never visually looks more
// premium than a Premium row, and combined with sanitizeTiers + the
// post-hoc hierarchy clamp below, VIP > Premium > Standard always holds.
const TIER_VARIANCE = {
  vip: { top: 1.10, bottom: 0.95 },
  premium: { top: 1.05, bottom: 0.95 },
  standard: { top: 1.00, bottom: 0.88 },
}

function tierConfigs(category) {
  switch (category) {
    case 'sports':
      return SPORTS_TIERS
    case 'concerts':
      return CONCERT_TIERS
    case 'arts':
    case 'family':
    default:
      return THEATER_TIERS
  }
}

const TIER_RANGES = {
  vip: { range: [5, 25], label: 'High Demand', lowLabel: 'Limited Availability' },
  premium: { range: [20, 50], label: 'Selling Fast' },
  standard: { range: [40, 80], label: 'Available' },
}

function buildAvailability(eventId, optionKey, tier) {
  const config = TIER_RANGES[tier] || TIER_RANGES.standard
  const rand = makeRng(`${eventId}-${optionKey}-availability`)
  const percent = pickInRange(rand, config.range[0], config.range[1])
  const lowStock = percent < 20
  return {
    availabilityPercent: percent,
    availabilityLabel:
      lowStock && config.lowLabel ? config.lowLabel : config.label,
    urgency: lowStock ? 'Only a few tickets left' : null,
  }
}

// Defensive numeric coerce. Returns fallback for NaN, null, undefined,
// strings that don't parse, or non-positive numbers.
function safeNumber(value, fallback) {
  if (value === null || value === undefined) return fallback
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n
}

/**
 * Read the admin-edited base prices off an event and enforce the
 * { standard < premium < vip } hierarchy with enough headroom that
 * tier-internal variance can't cause the row prices to overlap.
 *
 * Headroom math (matches TIER_VARIANCE):
 *   max(standard) = base_s × 1.00      — standard tops out at base
 *   min(premium)  = base_p × 0.95      — premium bottoms at base × 0.95
 *   need: base_s × 1.00 < base_p × 0.95
 *      → base_p ≥ base_s × 1.10  (10% headroom, safe margin)
 *
 *   max(premium)  = base_p × 1.05
 *   min(vip)      = base_v × 0.95
 *   need: base_p × 1.05 < base_v × 0.95
 *      → base_v ≥ base_p × 1.15  (15% headroom)
 *
 * Returns numbers guaranteed to be finite, positive, and ordered.
 */
export function sanitizeTiers(rawPricing, fallbackBase) {
  const fb = safeNumber(fallbackBase, 80)
  let standard = safeNumber(rawPricing?.standard, fb)
  let premium = safeNumber(rawPricing?.premium, Math.round(standard * 1.5))
  let vip = safeNumber(rawPricing?.vip, Math.round(standard * 2.4))

  const minPremium = Math.ceil(standard * 1.10)
  if (premium < minPremium) premium = minPremium
  const minVip = Math.ceil(premium * 1.15)
  if (vip < minVip) vip = minVip

  return { standard, premium, vip }
}

// Map a tier key (internal or category-specific label) to the matching
// base price on a sanitized pricing object.
function pickTierBase(pricing, tierKey) {
  if (tierKey === 'vip' || tierKey === 'front-row' || tierKey === 'orchestra') {
    return pricing.vip
  }
  if (tierKey === 'premium' || tierKey === 'floor' || tierKey === 'mezzanine') {
    return pricing.premium
  }
  return pricing.standard
}

function rowMultiplier(tierKey, t) {
  const v = TIER_VARIANCE[tierKey] || TIER_VARIANCE.standard
  // Linear descent from top → bottom across the tier's row range.
  // Clamp t into [0, 1] in case rows ever land outside their span.
  const clamped = Math.max(0, Math.min(1, t))
  return v.top - clamped * (v.top - v.bottom)
}

export function getSeatOptions(event) {
  if (!event) return []

  const fallbackBase = parsePrice(event.price)
  const tiers = sanitizeTiers(event.pricing, fallbackBase)
  const rand = makeRng(`${event.id || 'event'}-rows`)
  const configs = tierConfigs(event.category)

  // Compute raw options, grouped by tier so we can clamp hierarchies
  // after the fact.
  const grouped = { vip: [], premium: [], standard: [] }
  for (const cfg of configs) {
    const count = pickInRange(rand, cfg.countRange[0], cfg.countRange[1])
    const rows = pickUniqueRows(rand, count, cfg.rowRange[0], cfg.rowRange[1])
    const [low, high] = cfg.rowRange
    const span = (high - low) || 1
    const tierBase = pickTierBase(tiers, cfg.tier)

    rows.forEach((row) => {
      const t = (row - low) / span
      const mult = rowMultiplier(cfg.tier, t)
      // Guarantee a positive integer price even if some upstream value
      // somehow slipped through as NaN — sanitizeTiers + safeNumber
      // already cover this, but belt-and-suspenders avoids any chance
      // of a crash on the detail page.
      const raw = Math.round(tierBase * mult)
      const price = Number.isFinite(raw) && raw > 0 ? raw : tierBase
      grouped[cfg.tier].push({
        key: `${cfg.tier}-r${row}`,
        section: cfg.section,
        row,
        tier: cfg.tier,
        tierLabel: cfg.tierLabel,
        price,
      })
    })
  }

  // Final safety net: enforce VIP > Premium > Standard at the row level
  // even if a non-UI code path patched pricing in a way that bypassed
  // sanitizeTiers. Clamp lower-tier rows to stay strictly under the
  // cheapest seat of the next tier up.
  const minOf = (arr) =>
    arr.length ? arr.reduce((m, o) => (o.price < m ? o.price : m), arr[0].price) : Infinity

  if (grouped.vip.length && grouped.premium.length) {
    const vipFloor = minOf(grouped.vip)
    grouped.premium.forEach((o) => {
      if (o.price >= vipFloor) o.price = Math.max(1, vipFloor - 1)
    })
  }
  if (grouped.premium.length && grouped.standard.length) {
    const premiumFloor = minOf(grouped.premium)
    grouped.standard.forEach((o) => {
      if (o.price >= premiumFloor) o.price = Math.max(1, premiumFloor - 1)
    })
  }

  const options = [...grouped.vip, ...grouped.premium, ...grouped.standard]
  return options.map((o) => {
    const withAvail = {
      ...o,
      ...buildAvailability(event.id, o.key, o.tier),
    }
    // If an active promotion was decorated by the backend, replace
    // the per-row price with the discounted version and stash the
    // original on `originalPrice` so the UI can render a strikethrough.
    // Done at the row level so each row's variance carries through to
    // the customer-facing price. For percentage discounts this is
    // equivalent to discounting the tier base; for fixed-amount it
    // applies the same dollar reduction to every row in the tier.
    if (event.promotion) {
      const discounted = discountedRowPrice(withAvail.price, event.promotion)
      return {
        ...withAvail,
        originalPrice: withAvail.price,
        price: discounted,
      }
    }
    return withAvail
  })
}

// Helper: apply the active promotion to a single row's price.
function discountedRowPrice(originalPrice, promotion) {
  if (!promotion) return originalPrice
  const base = Number(originalPrice) || 0
  if (base <= 0) return 0
  if (promotion.discountType === 'percentage') {
    const pct = Math.max(0, Math.min(100, Number(promotion.discountValue) || 0))
    return Math.max(0, Math.round(base * (1 - pct / 100)))
  }
  if (promotion.discountType === 'fixed') {
    const amt = Math.max(0, Number(promotion.discountValue) || 0)
    return Math.max(0, Math.round(base - amt))
  }
  return base
}

export function availabilityColors(percent) {
  if (percent < 20) {
    return { text: 'text-red-600', fill: 'bg-red-500' }
  }
  if (percent < 50) {
    return { text: 'text-amber-600', fill: 'bg-amber-500' }
  }
  return { text: 'text-gray-600', fill: 'bg-gray-400' }
}

export const SERVICE_FEE_RATE = 0.12
