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

export function getSeatTiers(event) {
  const base = parsePrice(event.price)
  if (event.category === 'concerts') {
    return [
      {
        key: 'front-row',
        name: 'Front Row',
        description: 'Closest to the stage — direct artist view',
        price: Math.round(base * 2.2),
        badge: 'Best view',
      },
      {
        key: 'floor',
        name: 'Floor',
        description: 'Standing area near the stage with great atmosphere',
        price: Math.round(base * 1.5),
      },
      {
        key: 'ga',
        name: 'General Admission',
        description: 'Open seating in the main venue bowl',
        price: base,
      },
    ]
  }

  return [
    {
      key: 'vip',
      name: 'VIP Section',
      description: 'Premium midfield seats with hospitality access',
      price: Math.round(base * 2),
      badge: 'Best view',
    },
    {
      key: 'premium',
      name: 'Premium Section',
      description: 'Lower-tier seats with excellent sightlines',
      price: Math.round(base * 1.4),
    },
    {
      key: 'standard',
      name: 'Standard Section',
      description: 'Upper-tier seats with great atmosphere',
      price: base,
    },
  ]
}

export const SERVICE_FEE_RATE = 0.12
