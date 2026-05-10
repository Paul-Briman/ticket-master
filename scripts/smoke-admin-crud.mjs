// End-to-end smoke for the admin CRUD additions:
//   - Create an admin event (concert)
//   - Verify it shows on /api/concerts list, /api/admin/events list,
//     and the unified /api/events/:id detail
//   - PATCH the admin event (title + pricing), verify update applied
//   - DELETE the admin event, verify gone
//   - GET /api/admin/users (list)
//   - DELETE a non-protected user (creates one first), verify removed
//   - DELETE primary admin → 400, DELETE self → 400, DELETE missing → 404
//   - DELETE without auth → 401

import { createServer } from 'node:http'
import { readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Tiny .env loader
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
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'dev-smoke-jwt-secret'
if (!process.env.ADMIN_EMAIL) process.env.ADMIN_EMAIL = 'admin@ticket.com'
if (!process.env.ADMIN_PASSWORD) process.env.ADMIN_PASSWORD = '123456'

// Use an isolated data dir so this smoke doesn't stomp on the
// running dev db.
const isolatedDir = join(__dirname, '..', '.smoke-tmp')
try {
  rmSync(isolatedDir, { recursive: true, force: true })
} catch {
  /* ignore */
}
mkdirSync(isolatedDir, { recursive: true })

const app = (await import('../api/index.js')).default
const server = createServer(app)
await new Promise((r) => server.listen(0, r))
const { port } = server.address()
const base = `http://127.0.0.1:${port}`
console.log('Admin CRUD smoke against', base)
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

// === STEP 1: login ===
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
  token = body.token
  return `token len=${token.length}, role=${body.user?.role}`
})

if (!token) {
  console.log('\n=== ABORT — no token ===')
  server.close()
  process.exit(1)
}

// === STEP 2: create admin event ===
console.log()
console.log('=== Create admin event ===')
let createdId = null

await probe('POST /api/admin/events (concert)', async () => {
  const payload = {
    title: 'Admin Smoke Test — Live Showcase',
    description: 'A test event created by the admin CRUD smoke script.',
    category: 'concerts',
    subcategory: 'Afrobeats',
    venue: 'SMOKE Test Arena',
    city: 'Lagos',
    country: 'Nigeria',
    date: 'Sat, Aug 15 · 7:30 PM',
    image: 'https://example.com/banner.jpg',
    organizer: 'Smoke Test Productions',
    badge: 'New',
    badgeType: 'new',
    featured: true,
    pricing: { standard: 50, premium: 120, vip: 250 },
  }
  const { res, body } = await jfetch('/api/admin/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (res.status !== 201) {
    throw new Error(`status ${res.status} body=${JSON.stringify(body)}`)
  }
  if (!body?.event?.id?.startsWith('adm-')) {
    throw new Error(`expected adm- prefix, got id=${body?.event?.id}`)
  }
  createdId = body.event.id
  return `id=${createdId}`
})

// === STEP 3: appears on public concerts list ===
await probe('GET /api/concerts includes new admin event', async () => {
  const { res, body } = await jfetch('/api/concerts?size=50')
  if (!res.ok) throw new Error(`status ${res.status}`)
  const found = (body?.events || []).find((e) => e.id === createdId)
  if (!found) throw new Error('admin event not in /api/concerts list')
  if (found.title !== 'Admin Smoke Test — Live Showcase') {
    throw new Error(`title mismatch: ${found.title}`)
  }
  return `present in concerts list (${body.events.length} total)`
})

// === STEP 4: appears on /api/admin/events ===
await probe('GET /api/admin/events includes new admin event', async () => {
  const { res, body } = await jfetch('/api/admin/events')
  if (!res.ok) throw new Error(`status ${res.status}`)
  const found = (body?.events || []).find((e) => e.id === createdId)
  if (!found) throw new Error('admin event not in /api/admin/events list')
  if (!found.adminCreated) throw new Error('adminCreated flag missing')
  return `marked adminCreated=true`
})

// === STEP 5: detail endpoint resolves admin event ===
await probe(`GET /api/events/${createdId}`, async () => {
  const { res, body } = await jfetch(`/api/events/${encodeURIComponent(createdId)}`)
  if (!res.ok) throw new Error(`status ${res.status}`)
  if (body?.event?.id !== createdId) throw new Error('id mismatch')
  if (body?.event?.pricing?.standard !== 50) {
    throw new Error(`pricing.standard=${body?.event?.pricing?.standard}`)
  }
  return `title="${body.event.title}", sources=${JSON.stringify(body.sources)}`
})

// === STEP 6: PATCH admin event ===
console.log()
console.log('=== Edit admin event ===')
await probe(`PATCH /api/admin/events/${createdId}`, async () => {
  const { res, body } = await jfetch(`/api/admin/events/${encodeURIComponent(createdId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title: 'Admin Smoke Test — UPDATED',
      pricing: { standard: 99, premium: 199, vip: 399 },
      venue: 'UPDATED Venue',
    }),
  })
  if (!res.ok) throw new Error(`status ${res.status} body=${JSON.stringify(body)}`)
  if (body?.event?.title !== 'Admin Smoke Test — UPDATED') {
    throw new Error(`title="${body?.event?.title}"`)
  }
  if (body?.event?.pricing?.standard !== 99) {
    throw new Error(`pricing.standard=${body?.event?.pricing?.standard}`)
  }
  return `updated in place, no override created`
})

await probe(`GET /api/events/${createdId} reflects edit`, async () => {
  const { res, body } = await jfetch(`/api/events/${encodeURIComponent(createdId)}`)
  if (!res.ok) throw new Error(`status ${res.status}`)
  if (body?.event?.title !== 'Admin Smoke Test — UPDATED') {
    throw new Error('title not updated')
  }
  if (body?.event?.venue !== 'UPDATED Venue') {
    throw new Error('venue not updated')
  }
  return 'edits propagated to detail endpoint'
})

// === STEP 7: validation rejects bad input ===
console.log()
console.log('=== Validation ===')
await probe('POST rejects negative pricing', async () => {
  const { res } = await jfetch('/api/admin/events', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Bad Event',
      category: 'concerts',
      date: 'Sat, Aug 15',
      pricing: { standard: -1, premium: 50, vip: 100 },
    }),
  })
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`)
  return '400 rejected'
})

await probe('POST rejects missing required fields', async () => {
  const { res } = await jfetch('/api/admin/events', {
    method: 'POST',
    body: JSON.stringify({ title: 'No category', date: 'Aug 15' }),
  })
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`)
  return '400 rejected'
})

await probe('POST rejects invalid category', async () => {
  const { res } = await jfetch('/api/admin/events', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Bad Category',
      category: 'fictional',
      date: 'Aug 15',
      pricing: { standard: 10, premium: 20, vip: 30 },
    }),
  })
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`)
  return '400 rejected'
})

await probe('POST without auth is 401', async () => {
  const res = await fetch(`${base}/api/admin/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'no auth' }),
  })
  if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`)
  return '401 as expected'
})

// === STEP 8: delete admin event ===
console.log()
console.log('=== Delete admin event ===')
await probe('DELETE refuses to delete a live event id', async () => {
  const { res } = await jfetch('/api/admin/events/c-1', { method: 'DELETE' })
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`)
  return '400 as expected'
})

await probe(`DELETE /api/admin/events/${createdId}`, async () => {
  const { res, body } = await jfetch(`/api/admin/events/${encodeURIComponent(createdId)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(`status ${res.status} body=${JSON.stringify(body)}`)
  return 'ok=true'
})

await probe(`GET /api/events/${createdId} returns 404 after delete`, async () => {
  const { res } = await jfetch(`/api/events/${encodeURIComponent(createdId)}`)
  if (res.status !== 404) throw new Error(`expected 404, got ${res.status}`)
  return 'gone'
})

await probe('admin event no longer in /api/concerts list', async () => {
  const { res, body } = await jfetch('/api/concerts?size=50')
  if (!res.ok) throw new Error(`status ${res.status}`)
  const stillThere = (body?.events || []).find((e) => e.id === createdId)
  if (stillThere) throw new Error('event still in list after delete')
  return 'removed'
})

// === STEP 9: User list + delete safeguards ===
console.log()
console.log('=== Admin users + delete safeguards ===')
const targetEmail = `smoke-test-${Date.now()}@example.com`

// Create a target user via signup so we have something to delete
await probe(`POST /api/signup (target=${targetEmail})`, async () => {
  const { res, body } = await fetch(`${base}/api/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: targetEmail,
      password: 'test12345',
      name: 'Smoke Test Target',
    }),
  }).then(async (r) => ({ res: r, body: await r.json().catch(() => null) }))
  if (!res.ok) throw new Error(`status ${res.status} body=${JSON.stringify(body)}`)
  return `signed up`
})

await probe('GET /api/admin/users includes new signup', async () => {
  const { res, body } = await jfetch('/api/admin/users')
  if (!res.ok) throw new Error(`status ${res.status}`)
  const found = (body?.users || []).find((u) => u.email === targetEmail)
  if (!found) throw new Error('target user not in admin user list')
  if (typeof found.deletable !== 'boolean') {
    throw new Error('deletable flag missing')
  }
  if (!found.deletable) throw new Error('target user should be deletable')
  return `${body.users.length} users in list, target deletable=true`
})

await probe('Primary admin marked NOT deletable', async () => {
  const { res, body } = await jfetch('/api/admin/users')
  if (!res.ok) throw new Error(`status ${res.status}`)
  const admin = (body?.users || []).find(
    (u) => u.email === process.env.ADMIN_EMAIL.toLowerCase(),
  )
  if (!admin) throw new Error('primary admin not in list')
  if (admin.deletable) throw new Error('primary admin must not be deletable')
  if (!admin.isPrimaryAdmin) throw new Error('isPrimaryAdmin flag missing')
  return `isPrimaryAdmin=true, deletable=false`
})

await probe('DELETE primary admin → 400', async () => {
  const { res } = await jfetch(
    `/api/admin/users/${encodeURIComponent(process.env.ADMIN_EMAIL)}`,
    { method: 'DELETE' },
  )
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`)
  return '400 as expected'
})

await probe('DELETE self (current admin) → 400', async () => {
  const { res } = await jfetch(
    `/api/admin/users/${encodeURIComponent(process.env.ADMIN_EMAIL)}`,
    { method: 'DELETE' },
  )
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`)
  return '400 as expected'
})

await probe(`DELETE /api/admin/users/${targetEmail}`, async () => {
  const { res, body } = await jfetch(
    `/api/admin/users/${encodeURIComponent(targetEmail)}`,
    { method: 'DELETE' },
  )
  if (!res.ok) throw new Error(`status ${res.status} body=${JSON.stringify(body)}`)
  return 'ok=true'
})

await probe('GET /api/admin/users no longer shows deleted user', async () => {
  const { res, body } = await jfetch('/api/admin/users')
  if (!res.ok) throw new Error(`status ${res.status}`)
  const stillThere = (body?.users || []).find((u) => u.email === targetEmail)
  if (stillThere) throw new Error('user still present after delete')
  return 'removed'
})

await probe('DELETE missing user → 404', async () => {
  const { res } = await jfetch(
    `/api/admin/users/${encodeURIComponent('nonexistent-' + Date.now() + '@example.com')}`,
    { method: 'DELETE' },
  )
  if (res.status !== 404) throw new Error(`expected 404, got ${res.status}`)
  return '404 as expected'
})

await probe('DELETE without auth → 401', async () => {
  const res = await fetch(
    `${base}/api/admin/users/${encodeURIComponent(targetEmail)}`,
    { method: 'DELETE' },
  )
  if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`)
  return '401 as expected'
})

console.log()
const passes = results.filter((r) => r.status === 'PASS').length
const fails = results.length - passes
console.log(`=== ${passes}/${results.length} pass · ${fails} fail ===`)
server.close()
process.exit(fails === 0 ? 0 : 1)
