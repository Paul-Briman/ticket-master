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

export const LEAGUE_TO_SPORTDB_IDS = {
  'world-cup': ['4429', '4480'], // FIFA World Cup, UEFA Champions League (international football)
  ucl: ['4480'],                  // UEFA Champions League
  nba: ['4387'],                  // NBA
  nfl: ['4391'],                  // NFL
  f1: ['4370'],                   // Formula 1
  ufc: ['4443'],                  // UFC (MMA)
  tennis: ['4464'],               // ATP World Tour
  mlb: ['4424'],                  // MLB
  boxing: ['4624', '4625'],       // Boxing (best-effort league ids)
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

function formatDate(dateStr, timeStr) {
  if (!dateStr) return ''
  const t = (timeStr || '20:00:00').replace(/[+Z].*$/, '')
  const date = new Date(`${dateStr}T${t}`)
  if (Number.isNaN(date.getTime())) return ''
  let h = date.getHours()
  const m = String(date.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()} \u00B7 ${h}:${m} ${ampm}`
}

function isUpcoming(rawEvent) {
  if (!rawEvent?.dateEvent) return true // be lenient if no date
  const t = (rawEvent.strTime || '23:59:00').replace(/[+Z].*$/, '')
  const eventDate = new Date(`${rawEvent.dateEvent}T${t}`)
  if (Number.isNaN(eventDate.getTime())) return true
  // Allow up to 6 hours after start (live event in progress)
  return eventDate.getTime() + 6 * 3600 * 1000 >= Date.now()
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
    date: formatDate(e.dateEvent, e.strTime),
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

async function fetchNextEventsForId(id) {
  const url = `${BASE}/${apiKey()}/eventsnextleague.php?id=${id}`
  const res = await fetch(url)
  if (!res.ok) return []
  const json = await res.json()
  return Array.isArray(json?.events) ? json.events : []
}

function currentSeasonString() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  if (m >= 7) return `${y}-${y + 1}` // Jul-Dec → current/next year
  return `${y - 1}-${y}` // Jan-Jun → prev/current year
}

async function fetchSeasonEventsForId(id, season) {
  const url = `${BASE}/${apiKey()}/eventsseason.php?id=${id}&s=${encodeURIComponent(
    season,
  )}`
  const res = await fetch(url)
  if (!res.ok) return []
  const json = await res.json()
  return Array.isArray(json?.events) ? json.events : []
}

// ---------------------------------------------------------------------------
// League aggregation with strict sport filtering
// ---------------------------------------------------------------------------

const VOLUME_TARGET = 12 // aim for ~12 events per league

export async function fetchNextLeagueEvents(leagueKey) {
  const ids = LEAGUE_TO_SPORTDB_IDS[leagueKey]
  if (!ids || ids.length === 0) return []

  const expectedSport = LEAGUE_TO_SPORT[leagueKey]
  const seen = new Set()
  const collected = []

  // Step 1: pull "next" upcoming events for each underlying league id.
  for (const id of ids) {
    try {
      const events = await fetchNextEventsForId(id)
      for (const ev of events) {
        if (!ev?.idEvent || seen.has(ev.idEvent)) continue
        seen.add(ev.idEvent)
        collected.push(ev)
      }
    } catch (err) {
      console.warn(`[sportdb] next ${leagueKey}/${id} failed:`, err.message)
    }
  }

  // Step 2: if we're below target, augment with this season's schedule.
  if (collected.length < VOLUME_TARGET) {
    const season = currentSeasonString()
    for (const id of ids) {
      try {
        const seasonal = await fetchSeasonEventsForId(id, season)
        for (const ev of seasonal) {
          if (!ev?.idEvent || seen.has(ev.idEvent)) continue
          if (!isUpcoming(ev)) continue
          seen.add(ev.idEvent)
          collected.push(ev)
        }
        if (collected.length >= VOLUME_TARGET) break
      } catch (err) {
        console.warn(
          `[sportdb] season ${leagueKey}/${id} failed:`,
          err.message,
        )
      }
    }
  }

  // Step 3: STRICT sport filter — drop anything that's not the right sport.
  const filtered = expectedSport
    ? collected.filter((ev) => ev.strSport === expectedSport)
    : collected

  // Step 4: chronological order (earliest first), upcoming only.
  const sorted = filtered
    .filter(isUpcoming)
    .sort((a, b) => {
      const aTs = Date.parse(`${a.dateEvent}T${a.strTime || '00:00:00'}`)
      const bTs = Date.parse(`${b.dateEvent}T${b.strTime || '00:00:00'}`)
      return (aTs || 0) - (bTs || 0)
    })

  return sorted
    .map((e) => mapSportDbEvent(e, leagueKey))
    .filter(Boolean)
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
