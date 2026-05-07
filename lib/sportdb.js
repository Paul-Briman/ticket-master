// TheSportsDB integration — live sports metadata only.
// Pricing, seat tiers, ticketing logic remain fully internal.
// Docs: https://www.thesportsdb.com/api.php

const BASE = 'https://www.thesportsdb.com/api/v1/json'
const useKv = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)

let kvClient = null
async function getKv() {
  if (!kvClient) {
    const mod = await import('@vercel/kv')
    kvClient = mod.kv
  }
  return kvClient
}

// Free public key "3" works for the endpoints we use. Patreon-tier
// keys give richer data — set SPORTDB_API_KEY to override.
function apiKey() {
  return process.env.SPORTDB_API_KEY || '3'
}

// ---------------------------------------------------------------------------
// League → SportsDB ID mapping (multi-id for richer aggregation)
// ---------------------------------------------------------------------------
//
// Each internal league key maps to ONE OR MORE SportsDB league ids. When a
// league has limited fixtures on its own (e.g. World Cup year-round), we
// pull from related top-tier leagues so the section stays populated.
//
// CRITICAL: cross-sport contamination is prevented by enforcing
// LEAGUE_TO_SPORT below as a strict filter on every event.

// Strict 1:1 league mapping. Each section shows ONLY events from its own
// league. Tennis is the lone exception because the section label is the
// generic sport "Tennis" (ATP + WTA both belong here naturally).
export const LEAGUE_TO_SPORTDB_IDS = {
  'world-cup': ['4429'], // FIFA World Cup
  ucl: ['4480'],          // UEFA Champions League
  nba: ['4387'],          // NBA
  nfl: ['4391'],          // NFL
  f1: ['4370'],           // Formula 1
  ufc: ['4443'],          // UFC
  tennis: ['4464', '4528'], // ATP + WTA (both fit "Tennis")
  mlb: ['4424'],          // MLB
  boxing: ['4624'],       // Boxing
}

// Each league must only show events of THIS sport. Events that don't match
// are dropped — that's how we kill the cross-sport leak.
export const LEAGUE_TO_SPORT = {
  'world-cup': 'Soccer',
  ucl: 'Soccer',
  nba: 'Basketball',
  nfl: 'American Football',
  f1: 'Motorsport',
  ufc: 'Fighting',
  tennis: 'Tennis',
  mlb: 'Baseball',
  boxing: 'Boxing',
}

// Backwards compatibility: previous code referenced this — keep it as the
// "primary" league id for any callers that still want a single string.
export const SPORTDB_LEAGUE_IDS = Object.fromEntries(
  Object.entries(LEAGUE_TO_SPORTDB_IDS).map(([k, v]) => [k, v[0]]),
)

export const SUPPORTED_LEAGUES = new Set(Object.keys(LEAGUE_TO_SPORTDB_IDS))
export const LEAGUES_WITHOUT_LIVE = new Set(['olympics']) // genuinely no SportsDB feed

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function simpleHash(str) {
  let h = 0
  const s = String(str || '')
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function synthPrice(id, range = [60, 380]) {
  const [min, max] = range
  return min + (simpleHash(id) % (max - min + 1))
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Display the venue-local time when available; otherwise fall back to UTC
// dateEvent/strTime so we still produce a sensible label.
function formatDate(dateStr, timeStr, localDateStr, localTimeStr) {
  const useLocal = !!localDateStr
  const ds = useLocal ? localDateStr : dateStr
  if (!ds) return ''
  const ts = (useLocal ? localTimeStr : timeStr) || '20:00:00'
  const t = ts.replace(/[+Z].*$/, '')
  // local-naive parse — display as-is regardless of server timezone
  const date = new Date(`${ds}T${t}`)
  if (Number.isNaN(date.getTime())) return ''
  let h = date.getHours()
  const m = String(date.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()} \u00B7 ${h}:${m} ${ampm}`
}

// Parse a SportsDB event's dateEvent + strTime as UTC. SportsDB provides
// venue-local times in dateEventLocal/strTimeLocal — the unsuffixed pair
// is in UTC.
function eventUtcMs(rawEvent) {
  const date = rawEvent?.dateEvent
  const time = rawEvent?.strTime || '23:59:00'
  if (!date) return null
  const cleaned = time.replace(/[+Z].*$/, '')
  const ms = Date.parse(`${date}T${cleaned}Z`)
  return Number.isFinite(ms) ? ms : null
}

function isUpcoming(rawEvent) {
  const ms = eventUtcMs(rawEvent)
  if (ms === null) return true // be lenient if we can't parse
  // Allow up to 6 hours after start so a live in-progress event still shows
  return ms + 6 * 3600 * 1000 >= Date.now()
}

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function reverseMapLeague(strLeague) {
  const s = String(strLeague || '').toLowerCase()
  if (!s) return null
  if (s.includes('world cup')) return 'world-cup'
  if (s.includes('champions league')) return 'ucl'
  if (s.includes('nba')) return 'nba'
  if (s.includes('nfl')) return 'nfl'
  if (s.includes('formula 1') || s === 'f1') return 'f1'
  if (s.includes('ufc') || s.includes('mma')) return 'ufc'
  if (s.includes('atp') || s.includes('wta') || s.includes('tennis')) return 'tennis'
  if (s.includes('mlb') || s.includes('baseball')) return 'mlb'
  if (s.includes('boxing')) return 'boxing'
  return null
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

export function mapSportDbEvent(e, leagueKey) {
  if (!e || !e.idEvent) return null
  const title =
    e.strEvent ||
    (e.strHomeTeam && e.strAwayTeam ? `${e.strHomeTeam} vs ${e.strAwayTeam}` : null)
  if (!title) return null

  const cityName = e.strCity || ''
  const image = e.strThumb || e.strPoster || e.strBanner || null

  return {
    id: `sdb-${e.idEvent}`,
    sportsDbId: e.idEvent,
    title,
    category: 'sports',
    league: leagueKey || reverseMapLeague(e.strLeague),
    date: formatDate(e.dateEvent, e.strTime, e.dateEventLocal, e.strTimeLocal),
    city: cityName,
    citySlug: slugify(cityName),
    venue: e.strVenue || '',
    country: e.strCountry || '',
    price: `$${synthPrice(e.idEvent)}`,
    image,
    homeTeam: e.strHomeTeam || null,
    awayTeam: e.strAwayTeam || null,
    leagueLabel: e.strLeague || null,
    season: e.strSeason || null,
    sport: e.strSport || null,
    source: 'live',
  }
}

// ---------------------------------------------------------------------------
// Raw fetchers
// ---------------------------------------------------------------------------

async function safeJson(url) {
  const res = await fetch(url)
  if (!res.ok) return null
  const text = await res.text()
  if (!text || text.trim().startsWith('<')) return null // rate-limit / HTML
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function fetchNextEventsForId(id) {
  const json = await safeJson(`${BASE}/${apiKey()}/eventsnextleague.php?id=${id}`)
  return Array.isArray(json?.events) ? json.events : []
}

async function fetchSeasonEventsForId(id, season) {
  const json = await safeJson(
    `${BASE}/${apiKey()}/eventsseason.php?id=${id}&s=${encodeURIComponent(season)}`,
  )
  return Array.isArray(json?.events) ? json.events : []
}

// SportsDB's per-day endpoint takes &l=<league_id> (lowercase l, not id).
async function fetchDayEventsForId(id, dateStr) {
  const json = await safeJson(`${BASE}/${apiKey()}/eventsday.php?d=${dateStr}&l=${id}`)
  return Array.isArray(json?.events) ? json.events : []
}

// Some leagues use "YYYY-YYYY" (NBA, NFL, UCL season-spanning), others use
// just "YYYY" (FIFA World Cup, F1, ATP — calendar-year tournaments). Try
// the most likely candidate first per league, then fall back.
function seasonCandidates(leagueKey) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1

  const single = leagueKey === 'world-cup' || leagueKey === 'f1' ||
    leagueKey === 'tennis' || leagueKey === 'ufc' || leagueKey === 'boxing' ||
    leagueKey === 'mlb'

  if (single) {
    return [`${y}`, `${y + 1}`, `${y - 1}`]
  }
  // Cross-year leagues (NBA, NFL, UCL)
  if (m >= 7) {
    return [`${y}-${y + 1}`, `${y - 1}-${y}`]
  }
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

// ---------------------------------------------------------------------------
// League aggregation with strict sport filtering
// ---------------------------------------------------------------------------

const VOLUME_TARGET = 18 // aim for at least 10-25 events per league
const DAY_LOOKAHEAD = 10 // scan ~10 days via eventsday — balance volume vs rate-limits

export async function fetchNextLeagueEvents(leagueKey) {
  const ids = LEAGUE_TO_SPORTDB_IDS[leagueKey]
  if (!ids || ids.length === 0) return []

  const expectedSport = LEAGUE_TO_SPORT[leagueKey]
  const seen = new Set()
  const collected = []

  function ingest(events, { upcomingOnly = false } = {}) {
    for (const ev of events) {
      if (!ev?.idEvent || seen.has(ev.idEvent)) continue
      if (upcomingOnly && !isUpcoming(ev)) continue
      seen.add(ev.idEvent)
      collected.push(ev)
    }
  }

  // Phase A: parallel fan-out — eventsnextleague + eventsseason for every
  // (id × candidate season). Catches both ongoing leagues and upcoming
  // tournaments like the FIFA World Cup.
  const seasons = seasonCandidates(leagueKey)
  const phaseATasks = []
  for (const id of ids) {
    phaseATasks.push(fetchNextEventsForId(id))
    for (const season of seasons) {
      phaseATasks.push(fetchSeasonEventsForId(id, season))
    }
  }
  const phaseAResults = await Promise.allSettled(phaseATasks)
  for (const r of phaseAResults) {
    if (r.status === 'fulfilled') ingest(r.value, { upcomingOnly: true })
  }

  // Phase B: if we still don't have enough, scan the next ~10 days day by
  // day via eventsday — best for in-progress league seasons (NBA playoffs,
  // MLB regular season) where the free key truncates "next" / "season".
  // Chunked to concurrency 3 so we don't burst-trigger the SportsDB rate
  // limit (which returns HTML instead of JSON when overloaded).
  if (collected.length < VOLUME_TARGET) {
    const dates = nextNDates(DAY_LOOKAHEAD)
    const dayJobs = []
    for (const id of ids) {
      for (const date of dates) {
        dayJobs.push({ id, date })
      }
    }
    const CHUNK = 3
    for (let i = 0; i < dayJobs.length; i += CHUNK) {
      const slice = dayJobs.slice(i, i + CHUNK)
      const sliceResults = await Promise.allSettled(
        slice.map(({ id, date }) => fetchDayEventsForId(id, date)),
      )
      for (const r of sliceResults) {
        if (r.status === 'fulfilled') ingest(r.value, { upcomingOnly: true })
      }
      if (collected.length >= VOLUME_TARGET) break
    }
  }

  // STRICT sport filter — drop anything that doesn't match the league's
  // sport. Kills cross-sport leaks if SportsDB ever returns unrelated
  // events under a queried league id.
  const filtered = expectedSport
    ? collected.filter((ev) => ev.strSport === expectedSport)
    : collected

  // Upcoming only, sorted chronologically (earliest first).
  const sorted = filtered
    .filter(isUpcoming)
    .sort((a, b) => (eventUtcMs(a) || 0) - (eventUtcMs(b) || 0))

  return sorted.map((e) => mapSportDbEvent(e, leagueKey)).filter(Boolean)
}

export async function fetchEventById(id) {
  const url = `${BASE}/${apiKey()}/lookupevent.php?id=${encodeURIComponent(id)}`
  const res = await fetch(url)
  if (!res.ok) return null
  const json = await res.json()
  const ev = Array.isArray(json?.events) ? json.events[0] : null
  if (!ev) return null
  return mapSportDbEvent(ev, reverseMapLeague(ev.strLeague))
}

// Used when frontend asks for "all sports" with no league filter.
export async function fetchAllLeagues({ leagues = Object.keys(LEAGUE_TO_SPORTDB_IDS) } = {}) {
  const settled = await Promise.allSettled(
    leagues.map((key) => fetchNextLeagueEvents(key)),
  )
  const out = []
  settled.forEach((r) => {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) out.push(...r.value)
  })
  return out
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

export async function getCached(key) {
  if (!useKv) return null
  try {
    const k = await getKv()
    return await k.get(key)
  } catch (err) {
    console.warn('[sportdb] cache get failed:', err.message)
    return null
  }
}

export async function setCached(key, value, ttlSeconds = 3600) {
  if (!useKv) return
  try {
    const k = await getKv()
    await k.set(key, value, { ex: ttlSeconds })
  } catch (err) {
    console.warn('[sportdb] cache set failed:', err.message)
  }
}
