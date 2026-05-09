// Bandsintown adapter — provides live concert/tour data.
// Docs: https://artists.bandsintown.com/support/bandsintown-api
// Bandsintown's public REST endpoint uses an `app_id` parameter (no secret).

import {
  normalizeEvent,
  dedupeAndSortByDate,
  isUpcomingIso,
} from './normalize.js'

const BASE = 'https://rest.bandsintown.com'
export const PROVIDER_NAME = 'bandsintown'

// Curated trending-artist pool. Aggregating across these gives a healthy
// concert feed that always feels populated.
export const TRENDING_ARTISTS = [
  'Drake',
  'Burna Boy',
  'Travis Scott',
  'Taylor Swift',
  'The Weeknd',
  'Future',
  'Kendrick Lamar',
  'SZA',
  'Coldplay',
  'Bad Bunny',
  'Beyonce',
  'Billie Eilish',
]

function appId() {
  return process.env.BANDSINTOWN_APP_ID || 'ticketmaster-clone'
}

async function safeJson(url) {
  let res
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch (err) {
    return { ok: false, status: 'network-error', error: err.message }
  }
  if (res.status === 429) {
    return { ok: false, status: 'rate-limited', error: 'bandsintown 429' }
  }
  if (!res.ok) {
    return { ok: false, status: 'http-error', error: `bandsintown ${res.status}` }
  }
  const text = await res.text()
  if (!text) return { ok: true, json: [] }
  try {
    const json = JSON.parse(text)
    return { ok: true, json }
  } catch (err) {
    return { ok: false, status: 'parse-error', error: err.message }
  }
}

function mapEvent(e, artist) {
  if (!e?.id || !e.datetime) return null
  if (!isUpcomingIso(e.datetime)) return null

  const venue = e.venue || {}
  const headliner =
    Array.isArray(e.lineup) && e.lineup.length > 0 ? e.lineup[0] : artist
  const tourTitle = e.title && e.title.trim().length > 0 ? e.title : null
  const title = tourTitle || `${headliner} — Live`

  // Bandsintown doesn't include event images per event. Use the offered
  // poster from artist tour image if present, else null. Frontend already
  // tolerates a null image with a graceful placeholder.
  const image = e.artist?.image_url || e.artist?.thumb_url || null

  return normalizeEvent({
    id: `bit-${e.id}`,
    title,
    category: 'concerts',
    sport: null,
    league: null,
    venue: venue.name || '',
    city: venue.city || '',
    country: venue.country || '',
    image,
    utcDate: e.datetime, // already ISO
    provider: PROVIDER_NAME,
  })
}

async function fetchArtistEvents(artist) {
  const url = `${BASE}/artists/${encodeURIComponent(artist)}/events?app_id=${appId()}`
  const res = await safeJson(url)
  if (!res.ok) {
    console.warn(`[bandsintown] ${artist} failed:`, res.status, res.error)
    return { events: [], status: res.status, error: res.error }
  }
  const list = Array.isArray(res.json) ? res.json : []
  // Bandsintown sometimes returns artist info objects instead of events for
  // unknown artists; defensively skip non-arrays.
  const mapped = list
    .map((ev) => mapEvent(ev, artist))
    .filter(Boolean)
  return { events: mapped, status: 'ok', count: mapped.length }
}

/**
 * Aggregate upcoming concerts across the trending artist pool.
 */
export async function fetchAllConcerts({ limit = 25 } = {}) {
  const tasks = TRENDING_ARTISTS.map((artist) => fetchArtistEvents(artist))
  const settled = await Promise.allSettled(tasks)

  const collected = []
  let okCount = 0
  let errorCount = 0

  for (let i = 0; i < settled.length; i++) {
    const r = settled[i]
    if (r.status === 'fulfilled' && r.value.status === 'ok') {
      collected.push(...r.value.events)
      okCount++
    } else {
      errorCount++
    }
  }

  const events = dedupeAndSortByDate(collected).slice(0, limit)

  console.log(
    `[bandsintown] aggregated: ${events.length} concerts ` +
      `from ${okCount} artists (${errorCount} failed)`,
  )

  return {
    events,
    status: events.length > 0 ? 'ok' : okCount === 0 ? 'failed' : 'empty',
    providerStatus: okCount > 0 ? 'ok' : 'failed',
    artistsQueried: TRENDING_ARTISTS.length,
    artistsOk: okCount,
    artistsErr: errorCount,
  }
}
