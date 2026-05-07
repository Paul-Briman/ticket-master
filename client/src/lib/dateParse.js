const MONTHS = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
}

// Parse strings like "Thu, Jun 11 · 8:00 PM" into a real Date.
// Year is inferred (current year, rolling to next year if the date has passed).
export function parseEventDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const match = dateStr.match(
    /([A-Z][a-z]{2})\s+(\d{1,2}).*?(\d{1,2}):(\d{2})\s*(AM|PM)/,
  )
  if (!match) return null
  const [, mon, day, hour, min, ampm] = match
  const monthIdx = MONTHS[mon]
  if (monthIdx === undefined) return null

  let h = parseInt(hour, 10)
  if (ampm === 'PM' && h !== 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0

  const now = new Date()
  let date = new Date(now.getFullYear(), monthIdx, parseInt(day, 10), h, parseInt(min, 10))
  if (date.getTime() < now.getTime() - 12 * 3600 * 1000) {
    date = new Date(now.getFullYear() + 1, monthIdx, parseInt(day, 10), h, parseInt(min, 10))
  }
  return Number.isFinite(date.getTime()) ? date : null
}
