// End-to-end smoke for the Homepage Sections config.
//
// Contract under test:
//   1. Lazy seed: first GET returns the canonical default set with
//      all 7 known keys, enabled=true, limit=8.
//   2. PATCH validation: rejects bad payloads, clamps limits to
//      [1, 20], drops unknown keys, backfills missing canonical keys,
//      re-derives `order` from array position.
//   3. Admin auth: PATCH refuses non-admin tokens (401 / 403).
//   4. Persistence: subsequent GET returns whatever the last PATCH
//      saved.

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
const { db } = await import('../lib/db.js')

// Reset any persisted config so the "seed" assertion below actually
// exercises the lazy-seed path.
try {
  const key = 'tm:homepage-sections'
  // No public helper to delete keys; overwrite with null so the
  // route's Array.isArray check falls through and the seed reruns.
  await db.saveHomepageSections([])
} catch {
  // ignore — first-time run
}

const server = createServer(app)
await new Promise((r) => server.listen(0, r))
const { port } = server.address()
const base = `http://127.0.0.1:${port}`
console.log('Homepage-sections smoke against', base)
console.log()

const results = []
let adminToken = null
let userToken = null

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

async function jfetch(path, opts = {}, tok = null) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  if (tok && !headers.Authorization) headers.Authorization = `Bearer ${tok}`
  const res = await fetch(base + path, { ...opts, headers })
  const ct = res.headers.get('content-type') || ''
  const body = ct.includes('application/json')
    ? await res.json().catch(() => null)
    : await res.text()
  return { res, body }
}

const CANONICAL_KEYS = [
  'world-cup-knockout',
  'ucl',
  'nba',
  'featured-sports',
  'concerts',
  'arts',
  'family',
]

// === Auth ===
console.log('=== Auth ===')
await probe('Admin login', async () => {
  const { res, body } = await jfetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    }),
  })
  if (!res.ok) throw new Error(`status ${res.status}`)
  adminToken = body.token
  return `role=${body.user?.role}`
})

// Simple non-admin token so we can prove auth guards.
const userEmail = `homepage-smoke-${Date.now()}@example.com`
await probe(`Provision customer ${userEmail}`, async () => {
  const bcrypt = (await import('bcryptjs')).default
  await db.upsertUser({
    name: 'Homepage Smoke',
    email: userEmail,
    passwordHash: await bcrypt.hash('test12345', 4),
    role: 'user',
    isVerified: true,
    verifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  })
  const { res, body } = await jfetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email: userEmail, password: 'test12345' }),
  })
  if (!res.ok) throw new Error(`login status ${res.status}`)
  userToken = body.token
  return 'ok'
})

if (!adminToken || !userToken) {
  console.log('ABORT'); server.close(); process.exit(1)
}

// === Lazy seed ===
console.log()
console.log('=== Lazy seed of default homepage config ===')

await probe('GET /api/homepage-sections seeds canonical defaults', async () => {
  const { res, body } = await jfetch('/api/homepage-sections')
  if (!res.ok) throw new Error(`status ${res.status}`)
  const keys = (body.sections || []).map((s) => s.key)
  for (const k of CANONICAL_KEYS) {
    if (!keys.includes(k)) throw new Error(`missing canonical key ${k}`)
  }
  const enabledCount = body.sections.filter((s) => s.enabled).length
  if (enabledCount !== CANONICAL_KEYS.length) {
    throw new Error(`expected all enabled by default, got ${enabledCount}`)
  }
  const limits = body.sections.map((s) => s.limit)
  if (limits.some((l) => l !== 8)) {
    throw new Error(`expected limit=8 everywhere, got ${limits.join(',')}`)
  }
  return `${keys.length} sections, all enabled, limit=8`
})

await probe('First key by order = world-cup-knockout', async () => {
  const { body } = await jfetch('/api/homepage-sections')
  const sorted = [...body.sections].sort((a, b) => a.order - b.order)
  if (sorted[0].key !== 'world-cup-knockout') {
    throw new Error(`first key = ${sorted[0].key}`)
  }
  return 'ok'
})

// === Admin CRUD + validation ===
console.log()
console.log('=== Admin CRUD + validation ===')

await probe('PATCH clamps display limit to [1, 20]', async () => {
  const payload = CANONICAL_KEYS.map((k, i) => ({
    key: k,
    enabled: true,
    limit: i === 0 ? 999 : i === 1 ? 0 : 8,
    order: i,
  }))
  const { res, body } = await jfetch(
    '/api/admin/homepage-sections',
    { method: 'PATCH', body: JSON.stringify({ sections: payload }) },
    adminToken,
  )
  if (!res.ok) throw new Error(`status ${res.status}`)
  const first = body.sections.find((s) => s.key === CANONICAL_KEYS[0])
  const second = body.sections.find((s) => s.key === CANONICAL_KEYS[1])
  if (first.limit !== 20) throw new Error(`over-max not clamped: ${first.limit}`)
  if (second.limit !== 1) throw new Error(`under-min not clamped: ${second.limit}`)
  return `${first.limit},${second.limit}`
})

await probe('PATCH drops unknown keys silently', async () => {
  const payload = [
    ...CANONICAL_KEYS.map((k, i) => ({ key: k, enabled: true, limit: 8, order: i })),
    { key: 'bogus-section', enabled: true, limit: 8 },
  ]
  const { res, body } = await jfetch(
    '/api/admin/homepage-sections',
    { method: 'PATCH', body: JSON.stringify({ sections: payload }) },
    adminToken,
  )
  if (!res.ok) throw new Error(`status ${res.status}`)
  if (body.sections.find((s) => s.key === 'bogus-section')) {
    throw new Error('unknown key leaked into saved config')
  }
  return 'unknown key excluded'
})

await probe('PATCH backfills missing canonical keys', async () => {
  const partial = [
    { key: 'concerts', enabled: false, limit: 4 },
    { key: 'arts', enabled: true, limit: 10 },
  ]
  const { res, body } = await jfetch(
    '/api/admin/homepage-sections',
    { method: 'PATCH', body: JSON.stringify({ sections: partial }) },
    adminToken,
  )
  if (!res.ok) throw new Error(`status ${res.status}`)
  const keys = body.sections.map((s) => s.key)
  for (const k of CANONICAL_KEYS) {
    if (!keys.includes(k)) throw new Error(`missing backfilled key ${k}`)
  }
  const concerts = body.sections.find((s) => s.key === 'concerts')
  if (concerts.enabled !== false) throw new Error('concerts enable flag lost')
  if (concerts.limit !== 4) throw new Error('concerts limit lost')
  return 'partial payload → full canonical set persisted'
})

await probe('PATCH re-derives order from array position', async () => {
  // Send the canonical set in REVERSE order
  const payload = [...CANONICAL_KEYS].reverse().map((k, i) => ({
    key: k,
    enabled: true,
    limit: 8,
    order: 99, // deliberately wrong — backend should ignore
  }))
  const { res, body } = await jfetch(
    '/api/admin/homepage-sections',
    { method: 'PATCH', body: JSON.stringify({ sections: payload }) },
    adminToken,
  )
  if (!res.ok) throw new Error(`status ${res.status}`)
  const sorted = [...body.sections].sort((a, b) => a.order - b.order)
  if (sorted[0].key !== CANONICAL_KEYS[CANONICAL_KEYS.length - 1]) {
    throw new Error(`order not re-derived: first=${sorted[0].key}`)
  }
  if (sorted[sorted.length - 1].key !== CANONICAL_KEYS[0]) {
    throw new Error(`order not re-derived: last=${sorted[sorted.length - 1].key}`)
  }
  return `first=${sorted[0].key} last=${sorted[sorted.length - 1].key}`
})

await probe('PATCH rejects non-array payload → 400', async () => {
  const { res } = await jfetch(
    '/api/admin/homepage-sections',
    { method: 'PATCH', body: JSON.stringify({ sections: 'nope' }) },
    adminToken,
  )
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`)
  return '400'
})

// === Auth guards ===
console.log()
console.log('=== Auth guards ===')

await probe('PATCH without auth → 401', async () => {
  const res = await fetch(`${base}/api/admin/homepage-sections`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sections: [] }),
  })
  if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`)
  return '401'
})

await probe('PATCH with customer token → 403', async () => {
  const { res } = await jfetch(
    '/api/admin/homepage-sections',
    { method: 'PATCH', body: JSON.stringify({ sections: [] }) },
    userToken,
  )
  if (res.status !== 403) throw new Error(`expected 403, got ${res.status}`)
  return '403'
})

await probe('GET public endpoint is NOT auth-gated', async () => {
  const res = await fetch(`${base}/api/homepage-sections`)
  if (res.status !== 200) throw new Error(`expected 200, got ${res.status}`)
  return '200'
})

// === Persistence ===
console.log()
console.log('=== Persistence: GET reflects last PATCH ===')

await probe('Persist a specific enable + limit combo', async () => {
  const payload = CANONICAL_KEYS.map((k, i) => ({
    key: k,
    enabled: k !== 'nba',        // disable NBA
    limit: k === 'concerts' ? 12 : 6, // custom limits
    order: CANONICAL_KEYS.length - i, // reverse-ish
  }))
  await jfetch(
    '/api/admin/homepage-sections',
    { method: 'PATCH', body: JSON.stringify({ sections: payload }) },
    adminToken,
  )
  const { body } = await jfetch('/api/homepage-sections')
  const nba = body.sections.find((s) => s.key === 'nba')
  const concerts = body.sections.find((s) => s.key === 'concerts')
  if (nba.enabled !== false) throw new Error('NBA still enabled after PATCH')
  if (concerts.limit !== 12) throw new Error(`concerts limit=${concerts.limit}`)
  return `nba.enabled=false, concerts.limit=12 (persisted)`
})

// === Cleanup: restore defaults for other smokes ===
console.log()
console.log('=== Cleanup ===')

await probe('Restore default config for next smoke run', async () => {
  const defaults = CANONICAL_KEYS.map((k, i) => ({
    key: k, enabled: true, limit: 8, order: i,
  }))
  const { res } = await jfetch(
    '/api/admin/homepage-sections',
    { method: 'PATCH', body: JSON.stringify({ sections: defaults }) },
    adminToken,
  )
  if (!res.ok) throw new Error(`status ${res.status}`)
  return 'defaults restored'
})

await probe('Delete smoke customer', async () => {
  await db.deleteUser(userEmail)
  return 'gone'
})

console.log()
const passes = results.filter((r) => r.status === 'PASS').length
const fails = results.length - passes
console.log(`=== ${passes}/${results.length} pass · ${fails} fail ===`)
server.close()
process.exit(fails === 0 ? 0 : 1)
