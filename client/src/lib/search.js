// Cross-category event search.
//
// Operates entirely on the normalized event model returned by the
// existing list endpoints — no separate search dataset, no separate
// adapter. Whatever the API surfaces (live, curated, or admin-edited)
// is what gets searched.

const SEARCHABLE_FIELDS = [
  'title',
  'homeTeam',
  'awayTeam',
  'venue',
  'city',
  'country',
  'league',
  'sport',
  'category',
]

const CATEGORY_LABELS = {
  sports: 'Sports',
  concerts: 'Concerts',
  arts: 'Arts & Theater',
  family: 'Family',
}

/**
 * Tokenize the user's query into lowercase terms. Strips punctuation,
 * collapses whitespace. Empty query → no terms (caller decides how to
 * handle "show everything" vs "show nothing").
 */
export function tokenize(query) {
  return String(query || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function eventHaystack(event) {
  if (!event) return ''
  const parts = []
  for (const field of SEARCHABLE_FIELDS) {
    const v = event[field]
    if (v) parts.push(String(v))
  }
  if (event.category && CATEGORY_LABELS[event.category]) {
    parts.push(CATEGORY_LABELS[event.category])
  }
  return parts.join(' \u200B ').toLowerCase()
}

/**
 * AND-match: every token in the query must appear somewhere in the
 * event's haystack. Case-insensitive substring match per token.
 */
export function matchesQuery(event, terms) {
  if (!terms || terms.length === 0) return true
  const hay = eventHaystack(event)
  for (const term of terms) {
    if (!hay.includes(term)) return false
  }
  return true
}

/**
 * Filter a list of normalized events by a free-text query.
 * Returns the original list untouched when the query is empty.
 */
export function filterEvents(events, query) {
  const terms = tokenize(query)
  if (terms.length === 0) return events
  return events.filter((e) => matchesQuery(e, terms))
}
