// TheSportsDB adapter — used for sports leagues that football-data
// doesn't cover: NBA, NFL, MLB, F1, UFC, Tennis, Boxing.
// Docs: https://www.thesportsdb.com/api.php
// Uses the public free key '3' by default; SPORTDB_API_KEY overrides.

import {
  normalizeEvent,
  dedupeAndSortByDate,
  isUpcomingIso,
} from './normalize.js'

const BASE = 'https://www.thesportsdb.com/api/v1/json'

export const PROVIDER_NAME = 'sportdb'

// Strict 1:1 league → SportsDB id mapping. Tennis stays both ATP + WTA
// because the section label is the broad sport "Tennis".
export const LEAGUE_TO_SPORTDB_IDS = {
  nba: ['4387'],
  nfl: ['4391'],
  f1: ['4370'],
  ufc: ['4443'],
  tennis: ['4464', '4528'],
  mlb: ['4424'],
  boxing: ['4624'],
}

// Each league must only show events of THIS sport. SportsDB occasionally
// surfaces unrelated events under related ids, so this is the seatbelt.
export const LEAGUE_TO_SPORT = {
  nba: 'Basketball',
  nfl: 'American Football',
  f1: 'Motorsport',
  ufc: 'Fighting',
  tennis: 'Tennis',
  mlb: 'Baseball',
  boxing: 'Boxing',
}

function apiKey() {
  return process.env.SPORTDB_API_KEY || '3'
}

async function safeJson(url) {
  let res
  try {
    res = await fetch(url)
  } catch (err) {
    console.warn(`[sportdb] network error → ${url} :: ${err.message}`)
    return { ok: false, status: 'network-error', error: err.message }
  }
  console.log(`[sportdb] ${res.status} ${url}`)
  if (res.status === 429) {
    return { ok: false, status: 'rate-limited', error: 'sportdb 429' }
  }
  if (!res.ok) {
    return { ok: false, status: 'http-error', error: `sportdb ${res.status}` }
  }
  const text = await res.text()
  if (!text || text.trim().startsWith('<')) {
    return { ok: false, status: 'rate-limited', error: 'sportdb HTML response' }
  }
  try {
    return { ok: true, json: JSON.parse(text) }
  } catch (err) {
    return { ok: false, status: 'parse-error', error: err.message }
  }
}

function seasonCandidates(leagueKey) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const single = ['f1', 'tennis', 'ufc', 'boxing', 'mlb'].includes(leagueKey)
  if (single) return [`${y}`, `${y + 1}`, `${y - 1}`]
  if (m >= 7) return [`${y}-${y + 1}`, `${y - 1}-${y}`]
  return [`${y - 1}-${y}`, `${y}-${y + 1}`]
}

function nextNDates(n) {
  const out = []
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  for (let i = 0; i < n; i++) {
    const d = new Date(today.getTime() + i * 86400 * 1000)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

function buildUtcIso(rawEvent) {
  // SportsDB provides strTimestamp (ISO-ish UTC) sometimes.
  if (rawEvent.strTimestamp) {
    const ts = rawEvent.strTimestamp.endsWith('Z')
      ? rawEvent.strTimestamp
      : `${rawEvent.strTimestamp}Z`
    if (!Number.isNaN(Date.parse(ts))) return ts
  }
  if (rawEvent.dateEvent) {
    const time = (rawEvent.strTime || '23:59:00').replace(/[+Z].*$/, '')
    return `${rawEvent.dateEvent}T${time}Z`
  }
  return null
}

function mapEvent(e, leagueKey, { strict = true } = {}) {
  if (!e?.idEvent) return null
  const title =
    e.strEvent ||
    (e.strHomeTeam && e.strAwayTeam ? `${e.strHomeTeam} vs ${e.strAwayTeam}` : null)
  if (!title) return null

  const utcIso = buildUtcIso(e)

  // Strict mode (used by list endpoints) drops past events and cross-sport
  // mismatches. Lenient mode (used by direct id lookup) accepts whatever
  // the provider returned — the user is asking for THIS event by id.
  if (strict) {
    if (!utcIso || !isUpcomingIso(utcIso)) return null
    const expectedSport = LEAGUE_TO_SPORT[leagueKey]
    if (expectedSport && e.strSport !== expectedSport) return null
  }

  // normalizeEvent itself also applies an isUpcoming check when utcDate is
  // present, so for lenient lookups we pass utcDate=null and rely on `date`.
  const directDate = !strict && utcIso ? formatLocalFromRaw(e) : null

  return normalizeEvent({
    id: `sdb-${e.idEvent}`,
    providerId: e.idEvent, // raw SportsDB idEvent for clean detail lookups
    title,
    category: 'sports',
    sport: e.strSport || null,
    league: leagueKey,
    venue: e.strVenue || '',
    city: e.strCity || '',
    country: e.strCountry || '',
    image: e.strThumb || e.strPoster || e.strBanner || null,
    utcDate: strict ? utcIso : null,
    date: directDate,
    provider: PROVIDER_NAME,
  })
}

// Cheap local-time display string for direct lookups when we don't want
// the upcoming filter.
function formatLocalFromRaw(e) {
  const dateLocal = e.dateEventLocal || e.dateEvent
  const timeLocal = e.strTimeLocal || e.strTime || '20:00:00'
  if (!dateLocal) return null
  const parsed = new Date(`${dateLocal}T${String(timeLocal).replace(/[+Z].*$/, '')}`)
  if (Number.isNaN(parsed.getTime())) return null
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  let h = parsed.getHours()
  const m = String(parsed.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${days[parsed.getDay()]}, ${months[parsed.getMonth()]} ${parsed.getDate()} \u00B7 ${h}:${m} ${ampm}`
}

async function fetchNextForId(id) {
  const r = await safeJson(`${BASE}/${apiKey()}/eventsnextleague.php?id=${id}`)
  return r.ok && Array.isArray(r.json?.events) ? r.json.events : []
}

async function fetchSeasonForId(id, season) {
  const r = await safeJson(
    `${BASE}/${apiKey()}/eventsseason.php?id=${id}&s=${encodeURIComponent(season)}`,
  )
  return r.ok && Array.isArray(r.json?.events) ? r.json.events : []
}

async function fetchDayForId(id, date) {
  const r = await safeJson(`${BASE}/${apiKey()}/eventsday.php?d=${date}&l=${id}`)
  return r.ok && Array.isArray(r.json?.events) ? r.json.events : []
}

const VOLUME_TARGET = 18
const DAY_LOOKAHEAD = 10
const DAY_CONCURRENCY = 3

// Cap per league — keeps the UI tidy and consistent regardless of how
// much the upstream provider returns. Cards show "30+" when this hits.
export const MAX_EVENTS_PER_LEAGUE = 30

export async function fetchLeagueEvents(leagueKey) {
  const ids = LEAGUE_TO_SPORTDB_IDS[leagueKey]
  if (!ids || ids.length === 0) {
    return { events: [], status: 'unsupported', providerStatus: 'ok', leagueKey }
  }

  const seenRawIds = new Set()
  const rawEvents = []

  // Phase A: parallel next + season-candidate fan-out
  const seasons = seasonCandidates(leagueKey)
  const phaseATasks = []
  for (const id of ids) {
    phaseATasks.push(fetchNextForId(id))
    for (const season of seasons) {
      phaseATasks.push(fetchSeasonForId(id, season))
    }
  }
  const phaseAResults = await Promise.allSettled(phaseATasks)
  for (const r of phaseAResults) {
    if (r.status === 'fulfilled') {
      for (const ev of r.value) {
        if (ev?.idEvent && !seenRawIds.has(ev.idEvent)) {
          seenRawIds.add(ev.idEvent)
          rawEvents.push(ev)
        }
      }
    }
  }

  // Phase B: chunked day-by-day for in-progress league seasons
  const collected = rawEvents.map((e) => mapEvent(e, leagueKey)).filter(Boolean)
  if (collected.length < VOLUME_TARGET) {
    const dates = nextNDates(DAY_LOOKAHEAD)
    const jobs = []
    for (const id of ids) {
      for (const date of dates) {
        jobs.push({ id, date })
      }
    }
    for (let i = 0; i < jobs.length; i += DAY_CONCURRENCY) {
      const slice = jobs.slice(i, i + DAY_CONCURRENCY)
      const results = await Promise.allSettled(
        slice.map(({ id, date }) => fetchDayForId(id, date)),
      )
      for (const r of results) {
        if (r.status === 'fulfilled') {
          for (const ev of r.value) {
            if (!ev?.idEvent || seenRawIds.has(ev.idEvent)) continue
            seenRawIds.add(ev.idEvent)
            const mapped = mapEvent(ev, leagueKey)
            if (mapped) collected.push(mapped)
          }
        }
      }
      if (collected.length >= VOLUME_TARGET) break
    }
  }

  const sorted = dedupeAndSortByDate(collected)
  const events = sorted.slice(0, MAX_EVENTS_PER_LEAGUE)

  console.log(
    `[sportdb] ${leagueKey}: ids=${ids.join(',')} → ${events.length} events ` +
      `(of ${sorted.length} total upstream)`,
  )

  return {
    events,
    status: events.length > 0 ? 'ok' : 'empty',
    providerStatus: 'ok',
    leagueKey,
    capped: sorted.length > MAX_EVENTS_PER_LEAGUE,
  }
}

export async function fetchEventById(id) {
  const sdbId = String(id).startsWith('sdb-') ? String(id).slice(4) : String(id)
  const url = `${BASE}/${apiKey()}/lookupevent.php?id=${encodeURIComponent(sdbId)}`
  console.log(`[sportdb] lookupevent → ${sdbId}`)
  const r = await safeJson(url)
  if (!r.ok) {
    console.warn(`[sportdb] lookupevent failed: status=${r.status} error=${r.error}`)
    return null
  }
  console.log(
    `[sportdb] lookupevent response: top-level keys=${Object.keys(r.json || {}).join(',')} ` +
      `events=${Array.isArray(r.json?.events) ? r.json.events.length : 'n/a'}`,
  )
  const ev = Array.isArray(r.json?.events) ? r.json.events[0] : null
  if (!ev) {
    console.warn(`[sportdb] lookupevent: empty events array for id=${sdbId}`)
    return null
  }
  console.log(
    `[sportdb] raw event: idEvent=${ev.idEvent} title="${ev.strEvent}" ` +
      `sport=${ev.strSport} league=${ev.strLeague} dateEvent=${ev.dateEvent}`,
  )

  const reverse = (s) => {
    const x = String(s || '').toLowerCase()
    if (x.includes('nba')) return 'nba'
    if (x.includes('nfl')) return 'nfl'
    if (x.includes('formula 1')) return 'f1'
    if (x.includes('ufc') || x.includes('mma')) return 'ufc'
    if (x.includes('tennis') || x.includes('atp') || x.includes('wta')) return 'tennis'
    if (x.includes('mlb') || x.includes('baseball')) return 'mlb'
    if (x.includes('boxing')) return 'boxing'
    return null
  }

  // Direct id lookup is LENIENT — accept past events, cross-sport, etc.
  // The user clicked a specific card; surfacing it is more valuable than
  // protecting against the rare wrong-sport leak.
  const mapped = mapEvent(ev, reverse(ev.strLeague), { strict: false })
  if (!mapped) {
    console.warn(`[sportdb] lookupevent: mapEvent rejected idEvent=${ev.idEvent}`)
  }
  return mapped
}
