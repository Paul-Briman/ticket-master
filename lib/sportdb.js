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

// Free tier key "3" works for the endpoints we use. Patreon-tier keys give
// fuller historical data. Caller can override via env.
function apiKey() {
  return process.env.SPORTDB_API_KEY || '3'
}

// Map our internal league key → TheSportsDB league id.
// Source: https://www.thesportsdb.com/league
export const SPORTDB_LEAGUE_IDS = {
  'world-cup': '4429', // FIFA World Cup
  ucl: '4480',         // UEFA Champions League
  nba: '4387',         // NBA
  nfl: '4391',         // NFL
  f1: '4370',          // Formula 1
  ufc: '4443',         // UFC
  tennis: '4464',      // ATP World Tour
  mlb: '4424',         // MLB
}

// Leagues without a single canonical SportsDB id (boxing, olympics).
export const LEAGUES_WITHOUT_LIVE = new Set(['boxing', 'olympics'])

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
  // Treat as local-naive: dateEvent + strTime are in the venue's local time.
  const date = new Date(`${dateStr}T${t}`)
  if (Number.isNaN(date.getTime())) return ''
  let h = date.getHours()
  const m = String(date.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()} \u00B7 ${h}:${m} ${ampm}`
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
  if (s.includes('mlb')) return 'mlb'
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
    source: 'live',
  }
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

export async function fetchNextLeagueEvents(leagueKey) {
  const id = SPORTDB_LEAGUE_IDS[leagueKey]
  if (!id) return []

  const url = `${BASE}/${apiKey()}/eventsnextleague.php?id=${id}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`TheSportsDB ${res.status} for ${leagueKey}`)
  }
  const json = await res.json()
  const list = Array.isArray(json?.events) ? json.events : []
  return list.map((e) => mapSportDbEvent(e, leagueKey)).filter(Boolean)
}

export async function fetchEventById(id) {
  const url = `${BASE}/${apiKey()}/lookupevent.php?id=${encodeURIComponent(id)}`
  const res = await fetch(url)
  if (!res.ok) return null
  const json = await res.json()
  const ev = Array.isArray(json?.events) ? json.events[0] : null
  if (!ev) return null
  return mapSportDbEvent(ev, null)
}

export async function fetchAllLeagues({ leagues = Object.keys(SPORTDB_LEAGUE_IDS) } = {}) {
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
// Cache (Vercel KV with TTL)
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
