// Merge admin overrides onto a live or curated event. Overrides take
// precedence on every field they specify. The result still passes the
// normalized event contract (id stays stable, providerId stays stable).

const OVERRIDABLE_FIELDS = [
  'title',
  'image',
  'venue',
  'city',
  'country',
  'date',
  'price',
  'badge',
  'badgeType',
]

export function applyEventOverride(event, override) {
  if (!event) return event
  if (!override) return event

  const merged = { ...event }
  for (const field of OVERRIDABLE_FIELDS) {
    if (override[field] !== undefined && override[field] !== null && override[field] !== '') {
      merged[field] = override[field]
    }
  }

  // Pricing is a nested object — merge tier-by-tier so partial admin
  // edits don't blow away unchanged tiers.
  if (override.pricing && typeof override.pricing === 'object') {
    merged.pricing = {
      ...(event.pricing || {}),
      ...override.pricing,
    }
    // Update top-level price string to reflect new standard tier.
    if (override.pricing.standard != null) {
      merged.price = `$${override.pricing.standard}`
    }
  }

  if (event.citySlug && override.city) {
    // citySlug auto-recomputes if city changed
    merged.citySlug = override.city
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  merged.adminEdited = true
  return merged
}

export function applyOverridesToList(events, overridesMap) {
  if (!events?.length) return events || []
  if (!overridesMap || Object.keys(overridesMap).length === 0) return events
  return events.map((e) =>
    overridesMap[e.id] ? applyEventOverride(e, overridesMap[e.id]) : e,
  )
}
