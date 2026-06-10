// Single source of truth for "is this event still publicly visible?"
//
// Used by every public list endpoint (sports / concerts / arts /
// family), the unified detail endpoint, the admin-events router,
// and (mirrored) every relevant frontend selector. There must only
// ever be one definition of "expired" on the platform — this is it.
//
// Rule: an event is expired the instant its START timestamp has
// passed. No grace window. (The normalize-layer `isUpcomingIso` is
// kept separately as a more lenient ingestion filter, with a 6-hour
// in-progress allowance for the live providers; this stricter filter
// is applied at the list/response edge.)
//
// If we can't determine a start timestamp at all (rare — only when
// neither utcDate nor a parseable display date is present), we fail
// OPEN: the event remains visible. The admin can remove it manually
// if it's genuinely stale.

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

// If a parsed display date is further in the past than this, assume
// the curator meant next year. Prevents an "Aug 15" event listed in
// December from being silently treated as months-stale.
const ROLLOVER_DAYS = 30

/**
 * Parse a display string like "Sat, Jul 12 · 7:30 PM" into a unix
 * timestamp (ms). Returns null if the string doesn't match a known
 * shape. Falls back to Date.parse() first so ISO strings work too.
 */
export function parseDisplayDateToMs(displayDate, nowMs = Date.now()) {
  if (!displayDate || typeof displayDate !== 'string') return null

  // Try ISO 8601 first.
  const iso = Date.parse(displayDate)
  if (Number.isFinite(iso)) return iso

  // Match "[Weekday,] MMM DD · HH:MM AM/PM" with various separators.
  const m = displayDate.match(
    /(?:[A-Za-z]+,?\s+)?([A-Za-z]{3,9})\s+(\d{1,2})[^0-9]*?(\d{1,2}):(\d{2})\s*([AaPp][Mm])/,
  )
  if (!m) return null
  const monthIdx = MONTHS[m[1].toLowerCase().slice(0, 3)]
  if (monthIdx === undefined) return null
  const day = parseInt(m[2], 10)
  let hour = parseInt(m[3], 10)
  const min = parseInt(m[4], 10)
  const ampm = m[5].toUpperCase()
  if (ampm === 'PM' && hour !== 12) hour += 12
  if (ampm === 'AM' && hour === 12) hour = 0

  const now = new Date(nowMs)
  let year = now.getUTCFullYear()
  let ts = Date.UTC(year, monthIdx, day, hour, min)
  if (ts < nowMs - ROLLOVER_DAYS * 86_400_000) {
    ts = Date.UTC(year + 1, monthIdx, day, hour, min)
  }
  return ts
}

/**
 * Returns the event's canonical start timestamp (ms since epoch) or
 * null if neither utcDate nor a parseable display date is available.
 * `now` is forwarded to the display-string parser so the rollover
 * heuristic uses the same clock as the comparison.
 */
export function getEventStartMs(event, now = Date.now()) {
  if (!event) return null
  if (event.utcDate) {
    const ms = Date.parse(event.utcDate)
    if (Number.isFinite(ms)) return ms
  }
  if (event.date) {
    return parseDisplayDateToMs(event.date, now)
  }
  return null
}

/**
 * An event is "expired" once the start time has passed.
 * `now` is injectable for tests.
 */
export function isEventExpired(event, now = Date.now()) {
  const start = getEventStartMs(event, now)
  if (start === null) return false // fail open
  return start <= now
}

/** Public-visibility predicate. */
export function isEventVisible(event, now = Date.now()) {
  return !isEventExpired(event, now)
}

/**
 * Returns a NEW event object with `expired` and `startMs` annotated.
 * Used by detail + admin endpoints so the client can render the
 * appropriate state without re-parsing.
 */
export function annotateExpiry(event, now = Date.now()) {
  if (!event) return event
  const startMs = getEventStartMs(event, now)
  return {
    ...event,
    expired: startMs !== null && startMs <= now,
    startMs,
  }
}

/** Strip the expired entries out of a list. */
export function filterVisibleEvents(events, now = Date.now()) {
  if (!Array.isArray(events)) return []
  return events.filter((e) => isEventVisible(e, now))
}

/**
 * Split a list into { upcoming, expired }. Used by the admin
 * dashboard so admins can flip between active and historical events.
 */
export function splitByExpiry(events, now = Date.now()) {
  const upcoming = []
  const expired = []
  for (const e of events || []) {
    if (isEventExpired(e, now)) expired.push(e)
    else upcoming.push(e)
  }
  return { upcoming, expired }
}
