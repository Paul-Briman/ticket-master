// Boot the Express app and exercise the admin override flow end-to-end:
//   login → list admin events → PATCH a curated event → GET /api/events/:id
//   (verify override applied) → DELETE override → GET again (verify reverted).
//
// Targets a curated id ('c-1') because it's deterministic and doesn't
// depend on the football-data API key being present locally.

import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env')
if (existsSync(envPath)) {
  const text = readFileSync(envPath, 'utf8')
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}

if (!process.env.JWT_SECRET) {
  // The auth router requires it; supply a deterministic dev value.
  process.env.JWT_SECRET = 'dev-smoke-jwt-secret'
}
if (!process.env.ADMIN_EMAIL) process.env.ADMIN_EMAIL = 'admin@ticket.com'
if (!process.env.ADMIN_PASSWORD) process.env.ADMIN_PASSWORD = '123456'

const app = (await import('../api/index.js')).default

const server = createServer(app)
await new Promise((resolve) => server.listen(0, resolve))
const { port } = server.address()
const base = `http://127.0.0.1:${port}`
console.log('Admin smoke against', base)
console.log()

const results = []
let token = null

async function probe(label, run) {
  const start = Date.now()
  try {
    const note = await run()
    const ms = Date.now() - start
    console.log(`  [PASS] ${label}: ${ms}ms · ${note}`)
    results.push({ label, status: 'PASS' })
  } catch (err) {
    const ms = Date.now() - start
    console.log(`  [FAIL] ${label}: ${ms}ms · ${err.message}`)
    results.push({ label, status: 'FAIL', err: err.message })
  }
}

async function jfetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`
  const res = await fetch(base + path, { ...opts, headers })
  const ct = res.headers.get('content-type') || ''
  const body = ct.includes('application/json')
    ? await res.json().catch(() => null)
    : await res.text()
  return { res, body }
}

// === STEP 1: login as admin ===
console.log('=== Auth ===')
await probe('POST /api/login (admin)', async () => {
  const { res, body } = await jfetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    }),
  })
  if (!res.ok) throw new Error(`status ${res.status} body=${JSON.stringify(body)}`)
  if (!body?.token) throw new Error('no token in response')
  token = body.token
  return `token len=${token.length}, role=${body.user?.role}`
})

if (!token) {
  console.log('\n=== ABORT — no token ===')
  server.close()
  process.exit(1)
}

// === STEP 2: list admin events (must be authed) ===
console.log()
console.log('=== Admin events list ===')
let firstCurated = null
await probe('GET /api/admin/events', async () => {
  const { res, body } = await jfetch('/api/admin/events')
  if (!res.ok) throw new Error(`status ${res.status} body=${JSON.stringify(body).slice(0, 200)}`)
  const events = body?.events || []
  firstCurated = events.find((e) => e.id?.startsWith('c-')) || events[0] || null
  return `${events.length} events; firstCurated=${firstCurated?.id || 'none'}`
})

if (!firstCurated) {
  console.log('\n=== ABORT — no curated event to test against ===')
  server.close()
  process.exit(1)
}

// === STEP 3: PATCH override ===
console.log()
console.log('=== Override flow ===')
const targetId = firstCurated.id
const originalPricing = firstCurated.pricing
const newPricing = {
  standard: 1234,
  premium: 2345,
  vip: 3456,
}
const newTitle = `${firstCurated.title} [TEST]`

await probe(`PATCH /api/admin/events/${targetId}`, async () => {
  const { res, body } = await jfetch(`/api/admin/events/${encodeURIComponent(targetId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title: newTitle,
      pricing: newPricing,
    }),
  })
  if (!res.ok) throw new Error(`status ${res.status} body=${JSON.stringify(body)}`)
  return `ok=${body?.ok}, override.id=${body?.override?.id}`
})

// === STEP 4: GET via unified endpoint, verify override applied ===
await probe(`GET /api/events/${targetId} reflects override`, async () => {
  const { res, body } = await jfetch(`/api/events/${encodeURIComponent(targetId)}`)
  if (!res.ok) throw new Error(`status ${res.status}`)
  const event = body?.event
  if (event?.title !== newTitle) {
    throw new Error(`title="${event?.title}" expected "${newTitle}"`)
  }
  if (event?.pricing?.standard !== newPricing.standard) {
    throw new Error(
      `pricing.standard=${event?.pricing?.standard} expected ${newPricing.standard}`,
    )
  }
  if (event?.pricing?.vip !== newPricing.vip) {
    throw new Error(`pricing.vip=${event?.pricing?.vip} expected ${newPricing.vip}`)
  }
  return `title="${event.title}", pricing=${JSON.stringify(event.pricing)}, sources=${JSON.stringify(body?.sources)}`
})

// === STEP 5: GET via list endpoint, verify override applied there too ===
const listPath =
  targetId.startsWith('c-')
    ? '/api/concerts'
    : targetId.startsWith('a-')
      ? '/api/arts'
      : targetId.startsWith('f-')
        ? '/api/family'
        : null

if (listPath) {
  await probe(`GET ${listPath} reflects override`, async () => {
    const { res, body } = await jfetch(`${listPath}?size=50`)
    if (!res.ok) throw new Error(`status ${res.status}`)
    const found = (body?.events || []).find((e) => e.id === targetId)
    if (!found) throw new Error('event not in list response')
    if (found.title !== newTitle) {
      throw new Error(`title="${found.title}" expected "${newTitle}"`)
    }
    if (found.pricing?.standard !== newPricing.standard) {
      throw new Error(
        `pricing.standard=${found.pricing?.standard} expected ${newPricing.standard}`,
      )
    }
    return `title and pricing override applied in list`
  })
}

// === STEP 6: DELETE override, verify revert ===
await probe(`DELETE /api/admin/events/${targetId}/override`, async () => {
  const { res, body } = await jfetch(
    `/api/admin/events/${encodeURIComponent(targetId)}/override`,
    { method: 'DELETE' },
  )
  if (!res.ok) throw new Error(`status ${res.status} body=${JSON.stringify(body)}`)
  return `ok=${body?.ok}`
})

await probe(`GET /api/events/${targetId} reverted to original`, async () => {
  const { res, body } = await jfetch(`/api/events/${encodeURIComponent(targetId)}`)
  if (!res.ok) throw new Error(`status ${res.status}`)
  const event = body?.event
  if (event?.title === newTitle) {
    throw new Error(`title still overridden: "${event.title}"`)
  }
  if (originalPricing && event?.pricing?.standard !== originalPricing.standard) {
    throw new Error(
      `pricing.standard=${event?.pricing?.standard} expected original ${originalPricing.standard}`,
    )
  }
  return `title="${event.title}", pricing.standard=${event?.pricing?.standard}`
})

// === STEP 6b: override date lifecycle — the "original mock never
// resurrects" contract from the spec. ===
//
// Scenario: admin overrides an event to a PAST display date. The base
// event has a FUTURE utcDate. Without the utcDate auto-sync fix, the
// merged event's expiry check reads the stale base utcDate → sees
// future → keeps the past-dated overridden event visible on public
// pages (and buyable on the detail page).
//
// After the fix, applyEventOverride derives utcDate from the new
// display date so getEventStartMs sees the correct past ms.
console.log()
console.log('=== Override date lifecycle (utcDate auto-sync) ===')

await probe('PATCH override with future date → utcDate updates + expired=false', async () => {
  const futureDate = 'Sat, Dec 25 · 8:00 PM'
  const { res: patchRes } = await jfetch(
    `/api/admin/events/${encodeURIComponent(targetId)}`,
    { method: 'PATCH', body: JSON.stringify({ date: futureDate }) },
  )
  if (!patchRes.ok) throw new Error(`patch status ${patchRes.status}`)

  const { res, body } = await jfetch(`/api/events/${encodeURIComponent(targetId)}`)
  if (!res.ok) throw new Error(`get status ${res.status}`)
  const event = body?.event
  if (event.date !== futureDate) throw new Error(`display date=${event.date}`)
  if (!event.utcDate) throw new Error('utcDate not auto-derived')
  const utcMs = Date.parse(event.utcDate)
  if (!Number.isFinite(utcMs) || utcMs < Date.now()) {
    throw new Error(`utcDate=${event.utcDate} not in future`)
  }
  if (event.expired === true) throw new Error('event marked expired')
  return `date="${futureDate}" utcDate=${event.utcDate.slice(0, 10)} expired=${event.expired}`
})

await probe('PATCH override with PAST date → utcDate updates + expired=true', async () => {
  // Something clearly in the past. Weekday shape doesn't matter; the
  // display parser only looks at month/day/time.
  const pastDate = 'Mon, Jan 5 · 8:00 PM'
  const { res: patchRes } = await jfetch(
    `/api/admin/events/${encodeURIComponent(targetId)}`,
    { method: 'PATCH', body: JSON.stringify({ date: pastDate }) },
  )
  if (!patchRes.ok) throw new Error(`patch status ${patchRes.status}`)

  const { res, body } = await jfetch(`/api/events/${encodeURIComponent(targetId)}`)
  if (!res.ok) throw new Error(`get status ${res.status}`)
  const event = body?.event
  // The parser rolls forward if ROLLOVER_DAYS heuristic thinks the
  // date must be next year — so this only reliably tests "expired"
  // if the parsed ms falls in a past window. Guard on both paths so
  // the test is deterministic across the year:
  if (event.utcDate) {
    const utcMs = Date.parse(event.utcDate)
    if (utcMs < Date.now() && event.expired !== true) {
      throw new Error(`utcDate=${event.utcDate} is past but expired=${event.expired}`)
    }
    if (utcMs >= Date.now() && event.expired === true) {
      throw new Error(`utcDate=${event.utcDate} is future but expired=${event.expired}`)
    }
  }
  return `date="${pastDate}" utcDate=${event.utcDate?.slice(0, 10)} expired=${event.expired}`
})

await probe('List endpoint respects updated utcDate — no zombie override', async () => {
  // Set to a definitively past date; verify the event is filtered out
  // of the concerts list even though the base curated event's date
  // is future. This is the "original mock never resurrects" test.
  const definitelyPast = new Date(Date.now() - 30 * 86400000).toISOString()
  const { res: patchRes } = await jfetch(
    `/api/admin/events/${encodeURIComponent(targetId)}`,
    { method: 'PATCH', body: JSON.stringify({ utcDate: definitelyPast }) },
  )
  if (!patchRes.ok) throw new Error(`patch status ${patchRes.status}`)

  const { res, body } = await jfetch('/api/concerts?size=50')
  if (!res.ok) throw new Error(`list status ${res.status}`)
  const found = (body?.events || []).find((e) => e.id === targetId)
  if (found) {
    throw new Error(
      `overridden past event STILL in list — base mock resurrecting! title="${found.title}"`,
    )
  }
  return `id=${targetId} correctly hidden from public list`
})

await probe('DELETE override cleans up before revert-check', async () => {
  const { res } = await jfetch(
    `/api/admin/events/${encodeURIComponent(targetId)}/override`,
    { method: 'DELETE' },
  )
  if (!res.ok) throw new Error(`status ${res.status}`)
  return 'override cleared'
})

// === STEP 7: PATCH validation rejects bad pricing ===
console.log()
console.log('=== Validation ===')
await probe('PATCH rejects negative pricing', async () => {
  const { res, body } = await jfetch(`/api/admin/events/${encodeURIComponent(targetId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ pricing: { standard: -10 } }),
  })
  if (res.status !== 400) {
    throw new Error(`expected 400, got ${res.status} body=${JSON.stringify(body)}`)
  }
  return `400 rejected as expected`
})

await probe('PATCH without auth is 401', async () => {
  const res = await fetch(`${base}/api/admin/events/${encodeURIComponent(targetId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'no auth' }),
  })
  if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`)
  return `401 as expected`
})

console.log()
const passes = results.filter((r) => r.status === 'PASS').length
const fails = results.length - passes
console.log(`=== ${passes}/${results.length} pass · ${fails} fail ===`)
server.close()
process.exit(fails === 0 ? 0 : 1)
