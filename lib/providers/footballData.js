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
  if (!headers['X-Auth-Token']) {
    return { ok: false, status: 'unconfigured', error: 'API key missing' }
  }
  let res
  try {
    res = await fetch(url, { headers })
  } catch (err) {
    return { ok: false, status: 'network-error', error: err.message }
  }
  if (res.status === 429) {
    return { ok: false, status: 'rate-limited', error: 'football-data 429' }
  }
  if (res.status === 403) {
    return { ok: false, status: 'forbidden', error: 'API key invalid or tier-limited' }
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
  return { ok: true, json }
}

function mapMatch(m, leagueKey) {
  if (!m?.id || !m.utcDate) return null
  const home = m.homeTeam?.name || m.homeTeam?.shortName || 'TBD'
  const away = m.awayTeam?.name || m.awayTeam?.shortName || 'TBD'
  const title = `${home} vs ${away}`
  if (!isUpcomingIso(m.utcDate)) return null

  const venue = m.venue || ''
  const competitionEmblem = m.competition?.emblem || null
  const homeCrest = m.homeTeam?.crest || null
  const awayCrest = m.awayTeam?.crest || null

  return normalizeEvent({
    id: `fd-${m.id}`,
    title,
    category: 'sports',
    sport: 'Soccer',
    league: leagueKey,
    venue,
    city: '', // football-data v4 free tier rarely returns city
    country: '',
    image: competitionEmblem || homeCrest || awayCrest,
    utcDate: m.utcDate,
    provider: PROVIDER_NAME,
  })
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
