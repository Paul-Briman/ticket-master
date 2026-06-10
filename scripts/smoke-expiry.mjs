// End-to-end smoke for the event-expiration policy.
//
// Strategy:
//   1. Create two admin events — one in the past, one in the future.
//   2. Public concerts list must include the future one, exclude the
//      past one (single shared filter is applied).
//   3. /api/events/:id detail returns BOTH but annotates `expired`.
//   4. /api/admin/events?status=upcoming hides the expired event;
//      ?status=expired shows only the expired one; ?status=all shows
//      both with counts.
//   5. Cleanup: delete both admin events.

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'dev-smoke-jwt-secret'
if (!process.env.ADMIN_EMAIL) process.env.ADMIN_EMAIL = 'admin@ticket.com'
if (!process.env.ADMIN_PASSWORD) process.env.ADMIN_PASSWORD = '123456'

const app = (await import('../api/index.js')).default
const server = createServer(app)
await new Promise((r) => server.listen(0, r))
const { port } = server.address()
const base = `http://127.0.0.1:${port}`
console.log('Expiry smoke against', base)
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

console.log('=== Auth ===')
await probe('POST /api/login', async () => {
  const { res, body } = await jfetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    }),
  })
  if (!res.ok) throw new Error(`status ${res.status}`)
  token = body.token
  return `ok`
})
if (!token) { server.close(); process.exit(1) }

// === Build two admin events: one past, one future ===
console.log()
console.log('=== Seed past + future admin events ===')

const now = new Date()
const past = new Date(now.getTime() - 7 * 86400000) // 7 days ago
const future = new Date(now.getTime() + 30 * 86400000) // 30 days out

let pastId = null
let futureId = null

await probe('POST past admin event', async () => {
  const { res, body } = await jfetch('/api/admin/events', {
    method: 'POST',
    body: JSON.stringify({
      title: 'EXPIRY-SMOKE Past Concert',
      category: 'concerts',
      date: 'placeholder',
      utcDate: past.toISOString(),
      city: 'Lagos',
      pricing: { standard: 50, premium: 100, vip: 200 },
    }),
  })
  if (res.status !== 201) throw new Error(`status ${res.status}`)
  pastId = body.event.id
  return `id=${pastId}, utcDate=${past.toISOString()}`
})

await probe('POST future admin event', async () => {
  const { res, body } = await jfetch('/api/admin/events', {
    method: 'POST',
    body: JSON.stringify({
      title: 'EXPIRY-SMOKE Future Concert',
      category: 'concerts',
      date: 'placeholder',
      utcDate: future.toISOString(),
      city: 'Lagos',
      pricing: { standard: 50, premium: 100, vip: 200 },
    }),
  })
  if (res.status !== 201) throw new Error(`status ${res.status}`)
  futureId = body.event.id
  return `id=${futureId}, utcDate=${future.toISOString()}`
})

// === Public list endpoint: past is EXCLUDED, future is INCLUDED ===
console.log()
console.log('=== Public concerts list filters expired ===')
await probe('GET /api/concerts excludes expired event', async () => {
  const { res, body } = await jfetch('/api/concerts?size=50')
  if (!res.ok) throw new Error(`status ${res.status}`)
  const ids = (body?.events || []).map((e) => e.id)
  if (ids.includes(pastId)) throw new Error('expired event leaked into public list')
  if (!ids.includes(futureId)) throw new Error('future event missing from public list')
  return `future visible, past hidden (list size ${ids.length})`
})

// === Unified detail endpoint: BOTH resolvable, but `expired` annotated ===
console.log()
console.log('=== Detail endpoint annotates expired flag ===')
await probe('GET /api/events/<past> sets expired=true', async () => {
  const { res, body } = await jfetch(`/api/events/${encodeURIComponent(pastId)}`)
  if (!res.ok) throw new Error(`status ${res.status}`)
  if (body?.event?.expired !== true) {
    throw new Error(`expected expired=true, got ${body?.event?.expired}`)
  }
  return `event.expired=true`
})
await probe('GET /api/events/<future> sets expired=false', async () => {
  const { res, body } = await jfetch(`/api/events/${encodeURIComponent(futureId)}`)
  if (!res.ok) throw new Error(`status ${res.status}`)
  if (body?.event?.expired !== false) {
    throw new Error(`expected expired=false, got ${body?.event?.expired}`)
  }
  return `event.expired=false`
})

// === Admin endpoint with status filter ===
console.log()
console.log('=== Admin sees expired events with status filter ===')
await probe('GET /api/admin/events?status=upcoming hides expired', async () => {
  const { res, body } = await jfetch('/api/admin/events?status=upcoming')
  if (!res.ok) throw new Error(`status ${res.status}`)
  const ids = (body?.events || []).map((e) => e.id)
  if (ids.includes(pastId)) throw new Error('expired event present in upcoming filter')
  if (!ids.includes(futureId)) throw new Error('future event missing from upcoming filter')
  if (typeof body?.upcomingCount !== 'number') throw new Error('upcomingCount missing')
  if (typeof body?.expiredCount !== 'number') throw new Error('expiredCount missing')
  return `upcomingCount=${body.upcomingCount} expiredCount=${body.expiredCount}`
})

await probe('GET /api/admin/events?status=expired shows only expired', async () => {
  const { res, body } = await jfetch('/api/admin/events?status=expired')
  if (!res.ok) throw new Error(`status ${res.status}`)
  const ids = (body?.events || []).map((e) => e.id)
  if (!ids.includes(pastId)) throw new Error('expired event missing from expired filter')
  if (ids.includes(futureId)) throw new Error('future event present in expired filter')
  for (const e of body.events) {
    if (!e.expired) throw new Error(`event ${e.id} not flagged expired`)
  }
  return `all rows have expired=true`
})

await probe('GET /api/admin/events?status=all shows both', async () => {
  const { res, body } = await jfetch('/api/admin/events?status=all')
  if (!res.ok) throw new Error(`status ${res.status}`)
  const ids = (body?.events || []).map((e) => e.id)
  if (!ids.includes(pastId)) throw new Error('expired event missing from all')
  if (!ids.includes(futureId)) throw new Error('future event missing from all')
  return `both visible to admin (total ${body.events.length})`
})

// === Cleanup ===
console.log()
console.log('=== Cleanup ===')
await probe(`DELETE /api/admin/events/${pastId}`, async () => {
  const { res } = await jfetch(`/api/admin/events/${encodeURIComponent(pastId)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`status ${res.status}`)
  return 'gone'
})
await probe(`DELETE /api/admin/events/${futureId}`, async () => {
  const { res } = await jfetch(`/api/admin/events/${encodeURIComponent(futureId)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`status ${res.status}`)
  return 'gone'
})

console.log()
const passes = results.filter((r) => r.status === 'PASS').length
const fails = results.length - passes
console.log(`=== ${passes}/${results.length} pass · ${fails} fail ===`)
server.close()
process.exit(fails === 0 ? 0 : 1)
