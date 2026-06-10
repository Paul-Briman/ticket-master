// Single source of truth for "is this event still publicly visible?"
// IDENTICAL to lib/util/eventExpiry.js — duplicated only because Vite
// can't import from outside client/. If you change one, change both.

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

const ROLLOVER_DAYS = 30

export function parseDisplayDateToMs(displayDate, nowMs = Date.now()) {
  if (!displayDate || typeof displayDate !== 'string') return null
  const iso = Date.parse(displayDate)
  if (Number.isFinite(iso)) return iso

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

export function isEventExpired(event, now = Date.now()) {
  // Backend already annotates `expired` on detail / admin responses
  // so when present we trust it directly (saves re-parsing).
  if (event && typeof event.expired === 'boolean') return event.expired
  const start = getEventStartMs(event, now)
  if (start === null) return false
  return start <= now
}

export function isEventVisible(event, now = Date.now()) {
  return !isEventExpired(event, now)
}

export function filterVisibleEvents(events, now = Date.now()) {
  if (!Array.isArray(events)) return []
  return events.filter((e) => isEventVisible(e, now))
}

export function splitByExpiry(events, now = Date.now()) {
  const upcoming = []
  const expired = []
  for (const e of events || []) {
    if (isEventExpired(e, now)) expired.push(e)
    else upcoming.push(e)
  }
  return { upcoming, expired }
}
