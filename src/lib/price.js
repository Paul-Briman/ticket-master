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

export function getSeatOptions(event) {
  const base = parsePrice(event.price)

  if (event.category === 'concerts') {
    return [
      {
        key: 'fr-r1',
        section: 'Front Row',
        row: 1,
        tier: 'front-row',
        tierLabel: 'Front Row',
        price: r(base, 2.4),
        availability: 'Only 6 seats left',
        availabilityType: 'limited',
      },
      {
        key: 'fr-r2',
        section: 'Front Row',
        row: 2,
        tier: 'front-row',
        tierLabel: 'Front Row',
        price: r(base, 2.2),
        availability: 'Selling fast',
        availabilityType: 'hot',
      },
      {
        key: 'fl-r5',
        section: 'Floor',
        row: 5,
        tier: 'floor',
        tierLabel: 'Floor',
        price: r(base, 1.6),
        availability: null,
        availabilityType: null,
      },
      {
        key: 'fl-r8',
        section: 'Floor',
        row: 8,
        tier: 'floor',
        tierLabel: 'Floor',
        price: r(base, 1.4),
        availability: 'Only 18 seats left',
        availabilityType: 'limited',
      },
      {
        key: 'ga-a',
        section: 'General Admission',
        row: null,
        tier: 'ga',
        tierLabel: 'General Admission',
        price: r(base, 1.0),
        availability: null,
        availabilityType: null,
      },
      {
        key: 'ga-b',
        section: 'General Admission (Upper)',
        row: null,
        tier: 'ga',
        tierLabel: 'General Admission',
        price: r(base, 0.9),
        availability: 'Only 32 seats left',
        availabilityType: 'limited',
      },
    ]
  }

  return [
    {
      key: 'vip-r2',
      section: 'VIP Section',
      row: 2,
      tier: 'vip',
      tierLabel: 'VIP',
      price: r(base, 2.2),
      availability: 'Only 8 seats left',
      availabilityType: 'limited',
    },
    {
      key: 'vip-r4',
      section: 'VIP Section',
      row: 4,
      tier: 'vip',
      tierLabel: 'VIP',
      price: r(base, 2.0),
      availability: 'Only 12 seats left',
      availabilityType: 'limited',
    },
    {
      key: 'prem-r5',
      section: 'Section B',
      row: 5,
      tier: 'premium',
      tierLabel: 'Premium',
      price: r(base, 1.5),
      availability: 'Selling fast',
      availabilityType: 'hot',
    },
    {
      key: 'prem-r8',
      section: 'Section B',
      row: 8,
      tier: 'premium',
      tierLabel: 'Premium',
      price: r(base, 1.4),
      availability: null,
      availabilityType: null,
    },
    {
      key: 'std-r10',
      section: 'Section A',
      row: 10,
      tier: 'standard',
      tierLabel: 'Standard',
      price: r(base, 1.0),
      availability: null,
      availabilityType: null,
    },
    {
      key: 'std-r15',
      section: 'Section A',
      row: 15,
      tier: 'standard',
      tierLabel: 'Standard',
      price: r(base, 0.85),
      availability: 'Only 24 seats left',
      availabilityType: 'limited',
    },
  ]
}

export const SERVICE_FEE_RATE = 0.12
