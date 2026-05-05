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

function pickInRange(seed, min, max) {
  const range = max - min
  return min + (hash(seed) % (range + 1))
}

const TIER_RANGES = {
  vip: { range: [5, 25], label: 'High Demand', lowLabel: 'Limited Availability' },
  'front-row': { range: [5, 25], label: 'High Demand', lowLabel: 'Limited Availability' },
  premium: { range: [20, 50], label: 'Selling Fast' },
  floor: { range: [20, 50], label: 'Selling Fast' },
  standard: { range: [40, 80], label: 'Available' },
  ga: { range: [40, 80], label: 'Available' },
}

function buildAvailability(eventId, optionKey, tier) {
  const config = TIER_RANGES[tier] || TIER_RANGES.standard
  const percent = pickInRange(`${eventId}-${optionKey}`, config.range[0], config.range[1])
  const lowStock = percent < 20
  return {
    availabilityPercent: percent,
    availabilityLabel:
      lowStock && config.lowLabel ? config.lowLabel : config.label,
    urgency: lowStock ? 'Only a few tickets left' : null,
  }
}

function decorateOption(eventId, option) {
  return { ...option, ...buildAvailability(eventId, option.key, option.tier) }
}

export function getSeatOptions(event) {
  const base = parsePrice(event.price)
  const id = event.id

  if (event.category === 'concerts') {
    const raw = [
      { key: 'fr-r1', section: 'Front Row', row: 1, tier: 'front-row', tierLabel: 'Front Row', price: r(base, 2.4) },
      { key: 'fr-r2', section: 'Front Row', row: 2, tier: 'front-row', tierLabel: 'Front Row', price: r(base, 2.2) },
      { key: 'fl-r5', section: 'Floor', row: 5, tier: 'floor', tierLabel: 'Floor', price: r(base, 1.6) },
      { key: 'fl-r8', section: 'Floor', row: 8, tier: 'floor', tierLabel: 'Floor', price: r(base, 1.4) },
      { key: 'ga-a', section: 'General Admission', row: null, tier: 'ga', tierLabel: 'General Admission', price: r(base, 1.0) },
      { key: 'ga-b', section: 'General Admission (Upper)', row: null, tier: 'ga', tierLabel: 'General Admission', price: r(base, 0.9) },
    ]
    return raw.map((o) => decorateOption(id, o))
  }

  const raw = [
    { key: 'vip-r2', section: 'VIP Section', row: 2, tier: 'vip', tierLabel: 'VIP', price: r(base, 2.2) },
    { key: 'vip-r4', section: 'VIP Section', row: 4, tier: 'vip', tierLabel: 'VIP', price: r(base, 2.0) },
    { key: 'prem-r5', section: 'Section B', row: 5, tier: 'premium', tierLabel: 'Premium', price: r(base, 1.5) },
    { key: 'prem-r8', section: 'Section B', row: 8, tier: 'premium', tierLabel: 'Premium', price: r(base, 1.4) },
    { key: 'std-r10', section: 'Section A', row: 10, tier: 'standard', tierLabel: 'Standard', price: r(base, 1.0) },
    { key: 'std-r15', section: 'Section A', row: 15, tier: 'standard', tierLabel: 'Standard', price: r(base, 0.85) },
  ]
  return raw.map((o) => decorateOption(id, o))
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
