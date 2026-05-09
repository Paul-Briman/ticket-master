// football-data.org adapter — provides FIFA World Cup, UEFA Champions
// League, and the major European top-flight leagues.
// Docs: https://www.football-data.org/documentation/api
// Auth header: X-Auth-Token: <api key>
// Free tier: 10 requests / minute.

import {
  normalizeEvent,
  dedupeAndSortByDate,
  isUpcomingIso,
} from './normalize.js'

const BASE = 'https://api.football-data.org/v4'

export const PROVIDER_NAME = 'football-data'

// Cap per league. football-data returns the entire tournament (WC 2026 =
// 104 matches), but card UIs and league pages shouldn't try to render
// 100+ at once. Cards display "30+" when this cap is hit.
export const MAX_EVENTS_PER_LEAGUE = 30

// Internal league key → football-data competition code
export const LEAGUE_TO_FD_CODES = {
  'world-cup': ['WC'],
  ucl: ['CL'],
}

export function isFootballDataConfigured() {
  return !!process.env.FOOTBALL_DATA_API_KEY
}

function buildHeaders() {
  const key = process.env.FOOTBALL_DATA_API_KEY
  return key ? { 'X-Auth-Token': key } : {}
}

async function safeJson(url) {
  const headers = buildHeaders()
  console.log(`[football-data] → ${url}`)
  console.log(`[football-data]   X-Auth-Token present: ${!!headers['X-Auth-Token']}`)
  if (!headers['X-Auth-Token']) {
    return { ok: false, status: 'unconfigured', error: 'API key missing' }
  }
  let res
  try {
    res = await fetch(url, { headers })
  } catch (err) {
    console.warn(`[football-data] network error: ${err.message}`)
    return { ok: false, status: 'network-error', error: err.message }
  }
  console.log(
    `[football-data] ${res.status} ${res.statusText} ` +
      `| x-requests-available: ${res.headers.get('x-requests-available-minute') || 'n/a'}`,
  )
  if (res.status === 429) {
    return { ok: false, status: 'rate-limited', error: 'football-data 429' }
  }
  if (res.status === 403) {
    return { ok: false, status: 'forbidden', error: 'API key invalid or tier-limited' }
  }
  if (res.status === 401) {
    return { ok: false, status: 'unauthorized', error: 'API key rejected' }
  }
  if (!res.ok) {
    return { ok: false, status: 'http-error', error: `football-data ${res.status}` }
  }
  let json
  try {
    json = await res.json()
  } catch (err) {
    return { ok: false, status: 'parse-error', error: err.message }
  }
  console.log(
    `[football-data]   payload keys: ${Object.keys(json || {}).join(',')} ` +
      `| matches: ${Array.isArray(json?.matches) ? json.matches.length : 'n/a'}`,
  )
  if (Array.isArray(json?.matches) && json.matches.length > 0) {
    const m = json.matches[0]
    console.log(
      `[football-data]   first match: id=${m.id} ` +
        `${m.homeTeam?.name} vs ${m.awayTeam?.name} @ ${m.utcDate} ` +
        `comp=${m.competition?.name}`,
    )
  }
  return { ok: true, json }
}

function reverseMapLeague(competition) {
  const c = String(competition?.code || competition?.name || '').toLowerCase()
  if (c.includes('wc') || c.includes('world cup')) return 'world-cup'
  if (c.includes('cl') || c.includes('champions')) return 'ucl'
  return null
}

// Stadium → { city, country } for the most common UCL / WC venues.
// football-data's free tier rarely returns city/country directly, but
// match.venue is well populated, so we recover the location from this
// table. Lookup is case-insensitive substring match for resilience
// (e.g. "Allianz Arena, Munich" still matches "Allianz Arena").
const VENUE_LOCATIONS = [
  ['Wembley', 'London', 'England'],
  ['Old Trafford', 'Manchester', 'England'],
  ['Etihad', 'Manchester', 'England'],
  ['Anfield', 'Liverpool', 'England'],
  ['Stamford Bridge', 'London', 'England'],
  ['Emirates', 'London', 'England'],
  ['Tottenham Hotspur', 'London', 'England'],
  ['Santiago Bernabéu', 'Madrid', 'Spain'],
  ['Bernabéu', 'Madrid', 'Spain'],
  ['Bernabeu', 'Madrid', 'Spain'],
  ['Metropolitano', 'Madrid', 'Spain'],
  ['Camp Nou', 'Barcelona', 'Spain'],
  ["Lluís Companys", 'Barcelona', 'Spain'],
  ['Mestalla', 'Valencia', 'Spain'],
  ['Allianz Arena', 'Munich', 'Germany'],
  ['Signal Iduna', 'Dortmund', 'Germany'],
  ['Westfalenstadion', 'Dortmund', 'Germany'],
  ['Veltins-Arena', 'Gelsenkirchen', 'Germany'],
  ['Olympiastadion', 'Berlin', 'Germany'],
  ['San Siro', 'Milan', 'Italy'],
  ['Giuseppe Meazza', 'Milan', 'Italy'],
  ['Olimpico', 'Rome', 'Italy'],
  ['Diego Armando Maradona', 'Naples', 'Italy'],
  ['Allianz Stadium', 'Turin', 'Italy'],
  ['Parc des Princes', 'Paris', 'France'],
  ['Stade de France', 'Saint-Denis', 'France'],
  ['Vélodrome', 'Marseille', 'France'],
  ['Velodrome', 'Marseille', 'France'],
  ['Johan Cruijff', 'Amsterdam', 'Netherlands'],
  ['De Kuip', 'Rotterdam', 'Netherlands'],
  ['Estádio do Dragão', 'Porto', 'Portugal'],
  ['Estádio da Luz', 'Lisbon', 'Portugal'],
  ['Estádio José Alvalade', 'Lisbon', 'Portugal'],
  ['Atatürk', 'Istanbul', 'Turkey'],
  ['Ali Sami Yen', 'Istanbul', 'Turkey'],
  ['Türk Telekom', 'Istanbul', 'Turkey'],
  // 2026 World Cup venues
  ['MetLife', 'East Rutherford', 'United States'],
  ['SoFi Stadium', 'Los Angeles', 'United States'],
  ['Mercedes-Benz Stadium', 'Atlanta', 'United States'],
  ['Lincoln Financial', 'Philadelphia', 'United States'],
  ['Gillette', 'Foxborough', 'United States'],
  ['NRG Stadium', 'Houston', 'United States'],
  ['AT&T Stadium', 'Arlington', 'United States'],
  ['Lumen Field', 'Seattle', 'United States'],
  ['Levi\'s Stadium', 'Santa Clara', 'United States'],
  ['Levis Stadium', 'Santa Clara', 'United States'],
  ['Arrowhead', 'Kansas City', 'United States'],
  ['Hard Rock Stadium', 'Miami Gardens', 'United States'],
  ['BMO Field', 'Toronto', 'Canada'],
  ['BC Place', 'Vancouver', 'Canada'],
  ['Estadio Azteca', 'Mexico City', 'Mexico'],
  ['Akron', 'Guadalajara', 'Mexico'],
  ['BBVA', 'Monterrey', 'Mexico'],
]

function locationFromVenue(venue) {
  if (!venue) return { city: '', country: '' }
  const v = venue.toLowerCase()
  for (const [match, city, country] of VENUE_LOCATIONS) {
    if (v.includes(match.toLowerCase())) {
      return { city, country }
    }
  }
  return { city: '', country: '' }
}

function mapMatch(m, leagueKey, { strict = true } = {}) {
  if (!m?.id || !m.utcDate) return null
  const home = m.homeTeam?.name || m.homeTeam?.shortName || 'TBD'
  const away = m.awayTeam?.name || m.awayTeam?.shortName || 'TBD'
  const title = `${home} vs ${away}`
  if (strict && !isUpcomingIso(m.utcDate)) return null

  const venue = m.venue || ''
  const competitionEmblem = m.competition?.emblem || null
  const homeCrest = m.homeTeam?.crest || null
  const awayCrest = m.awayTeam?.crest || null

  // Image priority — all from real football-data assets:
  //  1. Home team crest (varies per match; different home teams per fixture)
  //  2. Away team crest (used when home crest missing)
  //  3. Competition emblem (last resort — same for every match)
  const image = homeCrest || awayCrest || competitionEmblem

  // Recover city/country. football-data free tier rarely supplies these
  // directly on the match, so we lean on the venue → location table for
  // city. For country we can fall back to competition.area (e.g. "Spain"
  // for La Liga). For WC the area is "World", which is useless — skip.
  const fromVenue = locationFromVenue(venue)
  const city = fromVenue.city || ''
  const compAreaName = m.competition?.area?.name
  const compAreaUseful =
    compAreaName && compAreaName !== 'World' && compAreaName !== 'Europe'
  const country =
    fromVenue.country ||
    (compAreaUseful ? compAreaName : '') ||
    m.homeTeam?.area?.name ||
    ''

  return normalizeEvent({
    id: `fd-${m.id}`,
    providerId: m.id, // raw football-data match id
    title,
    category: 'sports',
    sport: 'Soccer',
    league: leagueKey,
    venue,
    city,
    country,
    image,
    homeTeam: m.homeTeam?.name || m.homeTeam?.shortName || null,
    awayTeam: m.awayTeam?.name || m.awayTeam?.shortName || null,
    homeCrest,
    awayCrest,
    utcDate: strict ? m.utcDate : null,
    date: strict ? null : formatUtcDateForDisplay(m.utcDate),
    provider: PROVIDER_NAME,
  })
}

function formatUtcDateForDisplay(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  let h = d.getUTCHours()
  const m = String(d.getUTCMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${days[d.getUTCDay()]}, ${months[d.getUTCMonth()]} ${d.getUTCDate()} \u00B7 ${h}:${m} ${ampm}`
}

export async function fetchEventById(id) {
  const fdId = String(id).startsWith('fd-') ? String(id).slice(3) : String(id)
  const url = `${BASE}/matches/${encodeURIComponent(fdId)}`
  console.log(`[football-data] lookupmatch → ${fdId}`)
  const res = await safeJson(url)
  if (!res.ok) {
    console.warn(`[football-data] lookupmatch failed: status=${res.status} error=${res.error}`)
    return null
  }
  // /matches/{id} returns the match object directly (no array)
  const match = res.json?.id ? res.json : res.json?.match
  if (!match) {
    console.warn(`[football-data] lookupmatch: no match object in response`)
    return null
  }
  return mapMatch(match, reverseMapLeague(match.competition), { strict: false })
}

/**
 * Fetch upcoming matches for a competition code (e.g. 'CL', 'WC').
 * Returns { events, status, count } — never throws.
 */
async function fetchCompetitionMatches(code) {
  // SCHEDULED returns only upcoming. Fall back to any future match.
  const url = `${BASE}/competitions/${code}/matches?status=SCHEDULED`
  const res = await safeJson(url)
  if (!res.ok) {
    console.warn(`[football-data] ${code} fetch failed:`, res.status, res.error)
    return { events: [], status: res.status, error: res.error }
  }
  const matches = Array.isArray(res.json?.matches) ? res.json.matches : []
  return { events: matches, status: 'ok', count: matches.length }
}

/**
 * Fetch upcoming events for one of our internal league keys.
 * Returns { events, status, providerStatus, leagueKey }.
 */
export async function fetchLeagueEvents(leagueKey) {
  const codes = LEAGUE_TO_FD_CODES[leagueKey]
  if (!codes || codes.length === 0) {
    return {
      events: [],
      status: 'unsupported',
      providerStatus: 'ok',
      leagueKey,
    }
  }

  if (!isFootballDataConfigured()) {
    console.warn('[football-data] API key not set')
    return {
      events: [],
      status: 'unconfigured',
      providerStatus: 'unconfigured',
      leagueKey,
    }
  }

  const collected = []
  const errors = []
  for (const code of codes) {
    const r = await fetchCompetitionMatches(code)
    if (r.status === 'ok') {
      const mapped = r.events.map((m) => mapMatch(m, leagueKey)).filter(Boolean)
      collected.push(...mapped)
    } else {
      errors.push({ code, status: r.status, error: r.error })
    }
  }

  const sorted = dedupeAndSortByDate(collected)
  const events = sorted.slice(0, MAX_EVENTS_PER_LEAGUE)

  console.log(
    `[football-data] ${leagueKey}: codes=${codes.join(',')} → ` +
      `${events.length} events (of ${sorted.length} total upstream)`,
    errors.length ? `(errors: ${errors.length})` : '',
  )

  return {
    events,
    status: events.length > 0 ? 'ok' : errors.length ? 'partial-error' : 'empty',
    providerStatus: errors.length === codes.length ? 'failed' : 'ok',
    errors: errors.length ? errors : undefined,
    leagueKey,
    capped: sorted.length > MAX_EVENTS_PER_LEAGUE,
  }
}
