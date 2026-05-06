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

function lerp(t, from, to) {
  return from + t * (to - from)
}

const SPORTS_TIERS = [
  { tier: 'vip', tierLabel: 'VIP', section: 'VIP Section',
    countRange: [2, 4], rowRange: [1, 6], priceRange: [2.4, 1.8] },
  { tier: 'premium', tierLabel: 'Premium', section: 'Section B',
    countRange: [3, 5], rowRange: [5, 20], priceRange: [1.6, 1.2] },
  { tier: 'standard', tierLabel: 'Standard', section: 'Section A',
    countRange: [4, 6], rowRange: [15, 40], priceRange: [1.0, 0.7] },
]

const CONCERT_TIERS = [
  { tier: 'vip', tierLabel: 'VIP', section: 'Front Row',
    countRange: [2, 4], rowRange: [1, 5], priceRange: [2.4, 1.8] },
  { tier: 'premium', tierLabel: 'Premium', section: 'Floor',
    countRange: [3, 5], rowRange: [5, 15], priceRange: [1.6, 1.2] },
  { tier: 'standard', tierLabel: 'Standard', section: 'Mezzanine',
    countRange: [4, 6], rowRange: [10, 25], priceRange: [1.0, 0.7] },
]

const THEATER_TIERS = [
  { tier: 'vip', tierLabel: 'VIP', section: 'Orchestra',
    countRange: [2, 4], rowRange: [1, 3], priceRange: [2.4, 1.8] },
  { tier: 'premium', tierLabel: 'Premium', section: 'Mezzanine',
    countRange: [3, 5], rowRange: [3, 10], priceRange: [1.6, 1.2] },
  { tier: 'standard', tierLabel: 'Standard', section: 'Balcony',
    countRange: [4, 6], rowRange: [8, 18], priceRange: [1.0, 0.7] },
]

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

export function getSeatOptions(event) {
  if (!event) return []
  const base = parsePrice(event.price)
  const rand = makeRng(`${event.id}-rows`)
  const configs = tierConfigs(event.category)
  const options = []

  for (const cfg of configs) {
    const count = pickInRange(rand, cfg.countRange[0], cfg.countRange[1])
    const rows = pickUniqueRows(rand, count, cfg.rowRange[0], cfg.rowRange[1])
    const [low, high] = cfg.rowRange
    const span = high - low || 1

    rows.forEach((row) => {
      const t = (row - low) / span
      const mult = lerp(t, cfg.priceRange[0], cfg.priceRange[1])
      options.push({
        key: `${cfg.tier}-r${row}`,
        section: cfg.section,
        row,
        tier: cfg.tier,
        tierLabel: cfg.tierLabel,
        price: r(base, mult),
      })
    })
  }

  return options.map((o) => ({
    ...o,
    ...buildAvailability(event.id, o.key, o.tier),
  }))
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
