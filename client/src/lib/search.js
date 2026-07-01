// Cross-category event search.
//
// Operates entirely on the normalized event model returned by the
// existing list endpoints — no separate search dataset, no separate
// adapter. Whatever the API surfaces (live, curated, or admin-edited)
// is what gets searched.

// Every field that could contain something a customer might type
// into the search box. Do NOT prune this list unless you're sure —
// forward-compatible fields like `artist` / `tour` / `competition`
// are harmless to include even when the current provider data
// doesn't populate them (undefined values are silently skipped by
// eventHaystack), and they let admin-created events with those
// fields become discoverable without a schema migration.
const SEARCHABLE_FIELDS = [
  'title',
  'artist',
  'tour',
  'competition',
  'homeTeam',
  'awayTeam',
  'venue',
  'city',
  'country',
  'league',
  'sport',
  'category',
  'provider',
]

const CATEGORY_LABELS = {
  sports: 'Sports',
  concerts: 'Concerts',
  arts: 'Arts & Theater',
  family: 'Family',
}

// Friendly, human-readable expansions of the slug-shaped `league`
// field. Adds them to the haystack so "world" finds World Cup even
// though the stored league value is `world-cup` (which itself also
// contains "world" as a substring, but a slug fragment like `ucl`
// wouldn't otherwise match a search for "champions league"). Also
// covers common alternate names ("FIFA World Cup", "UEFA…").
const LEAGUE_LABELS = {
  'world-cup': 'FIFA World Cup Football Soccer',
  ucl: 'UEFA Champions League Football Soccer',
  nba: 'NBA National Basketball Association',
  nfl: 'NFL National Football League American Football',
  mlb: 'MLB Major League Baseball',
  f1: 'Formula 1 F1 Grand Prix Racing',
  ufc: 'UFC Ultimate Fighting Championship MMA',
  tennis: 'Tennis Grand Slam',
  boxing: 'Boxing',
}

// Sport-slug → friendly words. Same rationale as LEAGUE_LABELS —
// bridges the gap between programmatic slugs stored on events and
// natural-language queries.
const SPORT_LABELS = {
  football: 'Football Soccer',
  soccer: 'Soccer Football',
  basketball: 'Basketball',
  baseball: 'Baseball',
  hockey: 'Hockey',
  tennis: 'Tennis',
  boxing: 'Boxing',
  mma: 'MMA UFC',
  golf: 'Golf',
  racing: 'Racing Motorsport',
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
  if (event.league && LEAGUE_LABELS[event.league]) {
    parts.push(LEAGUE_LABELS[event.league])
  }
  if (event.sport && SPORT_LABELS[event.sport]) {
    parts.push(SPORT_LABELS[event.sport])
  }
  // ZWSP separator so tokens from different fields can't accidentally
  // fuse into a match ("cityvenue"). Downstream lowercase for
  // case-insensitive substring hits.
  return parts.join(' ​ ').toLowerCase()
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
