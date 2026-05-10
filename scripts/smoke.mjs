// Boots the Express app, hits the live endpoints, and reports.
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Tiny .env loader (avoid adding a dotenv dep just for tests).
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

const app = (await import('../api/index.js')).default

const port = 0 // OS-assigned ephemeral port
const server = createServer(app)
await new Promise((resolve) => server.listen(port, resolve))
const { port: listenPort } = server.address()
const base = `http://127.0.0.1:${listenPort}`

const results = []
const t0 = Date.now()

async function probe(label, path, validate) {
  const start = Date.now()
  let status = 'FAIL'
  let detail = ''
  try {
    const res = await fetch(base + path)
    const body = await res.json().catch(() => null)
    const ms = Date.now() - start
    const v = validate(res, body)
    if (v.ok) {
      status = 'PASS'
      detail = `${res.status} · ${ms}ms · ${v.note}`
    } else {
      detail = `${res.status} · ${ms}ms · ${v.note}`
    }
  } catch (err) {
    detail = `threw: ${err.message}`
  }
  console.log(`  [${status}] ${label}: ${detail}`)
  results.push({ label, status, detail })
}

console.log('Smoke test against booted Express app on', base)
console.log()

console.log('=== List endpoints (must return events; snapshots fire-and-forget) ===')
let firstUclSdbEvent = null
let firstFdEvent = null
let firstConcertId = null

await probe(
  'GET /api/concerts',
  '/api/concerts?size=10',
  (res, body) => {
    const events = body?.events
    if (!Array.isArray(events) || events.length === 0) {
      return { ok: false, note: 'no events returned' }
    }
    firstConcertId = events[0]?.id || null
    const e = events[0]
    return {
      ok:
        !!e?.id &&
        !!e?.title &&
        !!e?.pricing &&
        Number.isFinite(e.pricing.standard) &&
        Number.isFinite(e.pricing.premium) &&
        Number.isFinite(e.pricing.vip),
      note: `${events.length} events; first=${e?.id} pricing={s:${e?.pricing?.standard},p:${e?.pricing?.premium},v:${e?.pricing?.vip}}`,
    }
  },
)

await probe(
  'GET /api/arts',
  '/api/arts?size=5',
  (res, body) => {
    const events = body?.events
    return {
      ok: Array.isArray(events) && events.length > 0,
      note: `${events?.length ?? 0} events`,
    }
  },
)

await probe(
  'GET /api/family',
  '/api/family?size=5',
  (res, body) => {
    const events = body?.events
    return {
      ok: Array.isArray(events) && events.length > 0,
      note: `${events?.length ?? 0} events`,
    }
  },
)

await probe(
  'GET /api/sports?league=ucl',
  '/api/sports?league=ucl&size=10',
  (res, body) => {
    const events = body?.events
    if (!Array.isArray(events)) return { ok: false, note: 'events not array' }
    if (events.length > 0) firstFdEvent = events[0]
    return {
      ok: events.length > 0,
      note: `${events.length} events; status=${body?.status}; cache=${body?.cacheSource}`,
    }
  },
)

await probe(
  'GET /api/sports?league=world-cup',
  '/api/sports?league=world-cup&size=12',
  (res, body) => {
    const events = body?.events
    if (!Array.isArray(events)) return { ok: false, note: 'events not array' }
    if (events.length > 0 && !firstFdEvent) firstFdEvent = events[0]
    return {
      ok: events.length > 0,
      note: `${events.length} events; status=${body?.status}; cache=${body?.cacheSource}`,
    }
  },
)

await probe(
  'GET /api/sports?league=nba',
  '/api/sports?league=nba&size=10',
  (res, body) => {
    const events = body?.events
    if (!Array.isArray(events)) return { ok: false, note: 'events not array' }
    if (events.length > 0 && !firstUclSdbEvent) firstUclSdbEvent = events[0]
    return {
      ok: events.length > 0,
      note: `${events.length} events; status=${body?.status}`,
    }
  },
)

console.log()
console.log('=== Unified detail endpoint /api/events/:id ===')

if (firstConcertId) {
  await probe(
    `GET /api/events/${firstConcertId} (curated)`,
    `/api/events/${encodeURIComponent(firstConcertId)}`,
    (res, body) => {
      const e = body?.event
      return {
        ok: res.ok && !!e?.id && !!e?.title && !!e?.pricing,
        note: `title="${e?.title}"; sources=${JSON.stringify(body?.sources)}`,
      }
    },
  )
} else {
  console.log('  [SKIP] no concert id available')
}

if (firstFdEvent?.id) {
  await probe(
    `GET /api/events/${firstFdEvent.id} (football-data)`,
    `/api/events/${encodeURIComponent(firstFdEvent.id)}`,
    (res, body) => {
      const e = body?.event
      return {
        ok: res.ok && !!e?.id && !!e?.title,
        note: `title="${e?.title}"; sources=${JSON.stringify(body?.sources)}`,
      }
    },
  )
}

if (firstUclSdbEvent?.id) {
  await probe(
    `GET /api/events/${firstUclSdbEvent.id} (sportdb)`,
    `/api/events/${encodeURIComponent(firstUclSdbEvent.id)}`,
    (res, body) => {
      const e = body?.event
      return {
        ok: res.ok && !!e?.id && !!e?.title,
        note: `title="${e?.title}"; sources=${JSON.stringify(body?.sources)}`,
      }
    },
  )
}

await probe(
  'GET /api/events/sdb-99999999 (live=null path)',
  '/api/events/sdb-99999999',
  (res, body) => {
    // We expect either a valid event (if it happens to be in DB snapshot
    // from a prior run) or a clean 404 — never a 500 / hang.
    if (res.ok && body?.event?.id) {
      return { ok: true, note: 'served from snapshot' }
    }
    return {
      ok: res.status === 404,
      note: `status=${res.status} ${res.status === 404 ? '(clean 404)' : ''}`,
    }
  },
)

console.log()
console.log('=== Legacy /api/sports/:id (DB-first too) ===')
const legacyId = firstFdEvent?.id || firstUclSdbEvent?.id
if (legacyId) {
  await probe(
    `GET /api/sports/${legacyId}`,
    `/api/sports/${encodeURIComponent(legacyId)}`,
    (res, body) => {
      const e = body?.event
      return {
        ok: res.ok && !!e?.id && !!e?.title,
        note: `title="${e?.title}"`,
      }
    },
  )
} else {
  console.log('  [SKIP] no live sports event id available')
}

console.log()
const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
const passes = results.filter((r) => r.status === 'PASS').length
const fails = results.length - passes
console.log(`=== ${passes}/${results.length} pass · ${fails} fail · ${elapsed}s total ===`)

server.close()
process.exit(fails === 0 ? 0 : 1)
