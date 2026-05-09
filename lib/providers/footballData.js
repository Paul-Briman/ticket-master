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

  return normalizeEvent({
    id: `fd-${m.id}`,
    providerId: m.id, // raw football-data match id
    title,
    category: 'sports',
    sport: 'Soccer',
    league: leagueKey,
    venue,
    city: '', // football-data v4 free tier rarely returns city
    country: '',
    image: competitionEmblem || homeCrest || awayCrest,
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

  const events = dedupeAndSortByDate(collected)

  console.log(
    `[football-data] ${leagueKey}: codes=${codes.join(',')} → ${events.length} events`,
    errors.length ? `(errors: ${errors.length})` : '',
  )

  return {
    events,
    status: events.length > 0 ? 'ok' : errors.length ? 'partial-error' : 'empty',
    providerStatus: errors.length === codes.length ? 'failed' : 'ok',
    errors: errors.length ? errors : undefined,
    leagueKey,
  }
}
