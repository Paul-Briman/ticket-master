// End-to-end smoke for the order purchase / confirm / reject flow.
//
// Path A (Confirm):
//   1. Signup + verify a fresh customer (via direct DB shortcut — we
//      can't deliver OTPs from a smoke).
//   2. Customer places an order → status=Pending Payment.
//   3. Order appears in /api/my-orders immediately (this is the key
//      fix — used to be invisible to the customer until admin
//      confirmed).
//   4. Admin confirms → status=Paid + confirmedAt set.
//
// Path B (Reject):
//   1. Same setup, second order from same customer.
//   2. Customer sees it as Pending in /api/my-orders.
//   3. Admin rejects with a reason → status=Rejected + reason stored.
//   4. /api/my-orders surfaces the rejection reason for the customer.
//
// Transition guards:
//   - Confirm refuses a paid order (409)
//   - Confirm refuses a rejected order (409)
//   - Reject refuses a paid order (409)
//   - Reject refuses a rejected order (409)
//   - Confirm requires admin auth (401 / 403)
//   - Reject requires admin auth (401 / 403)

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

const server = createServer(app)
await new Promise((r) => server.listen(0, r))
const { port } = server.address()
const base = `http://127.0.0.1:${port}`
console.log('Order flow smoke against', base)
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

// === Auth ===
console.log('=== Auth setup ===')

await probe('Admin login', async () => {
  const { res, body } = await jfetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    }),
  })
  if (!res.ok) throw new Error(`status ${res.status} body=${JSON.stringify(body)}`)
  adminToken = body.token
  return `role=${body.user?.role}`
})

const customerEmail = `order-smoke-${Date.now()}@example.com`
// Provision the customer DIRECTLY in db (bypassing OTP — Resend would
// reject this synthetic address). We then log them in to get a JWT.
await probe(`Provision customer ${customerEmail}`, async () => {
  // bcryptjs is already a dep used by lib/routes/auth.js
  const bcrypt = (await import('bcryptjs')).default
  await db.upsertUser({
    name: 'Order Smoke',
    email: customerEmail,
    passwordHash: await bcrypt.hash('test12345', 4),
    role: 'user',
    isVerified: true,
    verified: true,
    verifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  })
  return 'inserted into db with verified=true'
})

await probe('Customer login', async () => {
  const { res, body } = await jfetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email: customerEmail, password: 'test12345' }),
  })
  if (!res.ok) throw new Error(`status ${res.status} body=${JSON.stringify(body)}`)
  userToken = body.token
  return `token len=${userToken.length}`
})

if (!adminToken || !userToken) {
  console.log('\n=== ABORT — missing tokens ===')
  server.close()
  process.exit(1)
}

// Shared order payload
const orderBody = {
  eventId: 'c-1',
  eventTitle: 'PSG vs Arsenal',
  eventDate: 'Sat, Jul 12 · 7:30 PM',
  eventVenue: 'Emirates Stadium',
  eventCity: 'London',
  eventCategory: 'sports',
  eventImage: '',
  user: 'Order Smoke',
  section: 'VIP Section',
  row: 1,
  tier: 'vip',
  tierLabel: 'VIP',
  quantity: 2,
  pricePerTicket: 250,
  subtotal: 500,
  fee: 60,
  total: 560,
}

// ====================== PATH A — CONFIRM ======================
console.log()
console.log('=== Path A: customer order → admin confirm ===')

let orderAId = null
await probe('Customer creates order A (pending)', async () => {
  const { res, body } = await jfetch(
    '/api/create-order',
    { method: 'POST', body: JSON.stringify(orderBody) },
    userToken,
  )
  if (res.status !== 201) throw new Error(`status ${res.status} body=${JSON.stringify(body)}`)
  if (body.order.status !== 'Pending Payment') {
    throw new Error(`status=${body.order.status} expected Pending Payment`)
  }
  orderAId = body.order.id
  return `id=${orderAId} status=${body.order.status}`
})

await probe('Customer my-orders includes pending order immediately', async () => {
  const { res, body } = await jfetch('/api/my-orders', {}, userToken)
  if (!res.ok) throw new Error(`status ${res.status}`)
  const found = (body.orders || []).find((o) => o.id === orderAId)
  if (!found) throw new Error('pending order missing from my-orders (regression!)')
  if (found.status !== 'Pending Payment') {
    throw new Error(`pending order in list with status=${found.status}`)
  }
  return `pending order visible to customer (${body.orders.length} total)`
})

await probe('Admin confirms order A', async () => {
  const { res, body } = await jfetch(
    '/api/confirm-payment',
    { method: 'POST', body: JSON.stringify({ orderId: orderAId }) },
    adminToken,
  )
  if (!res.ok) throw new Error(`status ${res.status} body=${JSON.stringify(body)}`)
  if (body.order.status !== 'Paid') {
    throw new Error(`status=${body.order.status} expected Paid`)
  }
  if (!body.order.confirmedAt) throw new Error('confirmedAt not set')
  return `status=Paid, confirmedAt set`
})

await probe('Customer my-orders shows order A as Paid', async () => {
  const { res, body } = await jfetch('/api/my-orders', {}, userToken)
  if (!res.ok) throw new Error(`status ${res.status}`)
  const found = (body.orders || []).find((o) => o.id === orderAId)
  if (!found) throw new Error('order missing')
  if (found.status !== 'Paid') throw new Error(`status=${found.status}`)
  return `Paid`
})

// ====================== PATH B — REJECT =======================
console.log()
console.log('=== Path B: customer order → admin reject with reason ===')

let orderBId = null
await probe('Customer creates order B (pending)', async () => {
  const { res, body } = await jfetch(
    '/api/create-order',
    {
      method: 'POST',
      body: JSON.stringify({ ...orderBody, eventTitle: 'PSG vs Real Madrid' }),
    },
    userToken,
  )
  if (res.status !== 201) throw new Error(`status ${res.status}`)
  orderBId = body.order.id
  return `id=${orderBId}`
})

await probe('Admin rejects order B with reason', async () => {
  const reason = 'Could not verify transaction hash. Please resubmit.'
  const { res, body } = await jfetch(
    '/api/reject-payment',
    {
      method: 'POST',
      body: JSON.stringify({ orderId: orderBId, reason }),
    },
    adminToken,
  )
  if (!res.ok) throw new Error(`status ${res.status} body=${JSON.stringify(body)}`)
  if (body.order.status !== 'Rejected') {
    throw new Error(`status=${body.order.status} expected Rejected`)
  }
  if (body.order.rejectionReason !== reason) {
    throw new Error(`reason=${body.order.rejectionReason}`)
  }
  if (!body.order.rejectedAt) throw new Error('rejectedAt not set')
  return `status=Rejected, reason stored`
})

await probe('Customer my-orders shows order B as Rejected with reason', async () => {
  const { res, body } = await jfetch('/api/my-orders', {}, userToken)
  if (!res.ok) throw new Error(`status ${res.status}`)
  const found = (body.orders || []).find((o) => o.id === orderBId)
  if (!found) throw new Error('order missing')
  if (found.status !== 'Rejected') throw new Error(`status=${found.status}`)
  if (!found.rejectionReason) throw new Error('rejectionReason not surfaced')
  return `Rejected with reason`
})

await probe('Customer my-orders also still shows order A as Paid', async () => {
  const { res, body } = await jfetch('/api/my-orders', {}, userToken)
  if (!res.ok) throw new Error(`status ${res.status}`)
  const a = (body.orders || []).find((o) => o.id === orderAId)
  const b = (body.orders || []).find((o) => o.id === orderBId)
  if (!a || a.status !== 'Paid') throw new Error('A not Paid')
  if (!b || b.status !== 'Rejected') throw new Error('B not Rejected')
  return `A=Paid B=Rejected (both surfaced to customer)`
})

// ====================== Transition guards =====================
console.log()
console.log('=== Terminal-state transitions are frozen ===')

await probe('Confirm a Paid order → 409', async () => {
  const { res } = await jfetch(
    '/api/confirm-payment',
    { method: 'POST', body: JSON.stringify({ orderId: orderAId }) },
    adminToken,
  )
  if (res.status !== 409) throw new Error(`expected 409, got ${res.status}`)
  return '409'
})

await probe('Reject a Paid order → 409', async () => {
  const { res } = await jfetch(
    '/api/reject-payment',
    { method: 'POST', body: JSON.stringify({ orderId: orderAId, reason: 'oops' }) },
    adminToken,
  )
  if (res.status !== 409) throw new Error(`expected 409, got ${res.status}`)
  return '409'
})

await probe('Confirm a Rejected order → 409', async () => {
  const { res } = await jfetch(
    '/api/confirm-payment',
    { method: 'POST', body: JSON.stringify({ orderId: orderBId }) },
    adminToken,
  )
  if (res.status !== 409) throw new Error(`expected 409, got ${res.status}`)
  return '409'
})

await probe('Reject a Rejected order → 409', async () => {
  const { res } = await jfetch(
    '/api/reject-payment',
    { method: 'POST', body: JSON.stringify({ orderId: orderBId, reason: 'again' }) },
    adminToken,
  )
  if (res.status !== 409) throw new Error(`expected 409, got ${res.status}`)
  return '409'
})

// ====================== Auth guards ===========================
console.log()
console.log('=== Auth guards ===')

await probe('Reject without auth → 401', async () => {
  const res = await fetch(`${base}/api/reject-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: orderAId }),
  })
  if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`)
  return '401'
})

await probe('Reject with customer token → 403 (not admin)', async () => {
  const { res } = await jfetch(
    '/api/reject-payment',
    { method: 'POST', body: JSON.stringify({ orderId: orderAId }) },
    userToken,
  )
  // requireAdmin throws status 403
  if (res.status !== 403) throw new Error(`expected 403, got ${res.status}`)
  return '403'
})

await probe('Reject unknown order → 404', async () => {
  const { res } = await jfetch(
    '/api/reject-payment',
    { method: 'POST', body: JSON.stringify({ orderId: 'ord-does-not-exist' }) },
    adminToken,
  )
  if (res.status !== 404) throw new Error(`expected 404, got ${res.status}`)
  return '404'
})

await probe('Reject without orderId → 400', async () => {
  const { res } = await jfetch(
    '/api/reject-payment',
    { method: 'POST', body: JSON.stringify({}) },
    adminToken,
  )
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`)
  return '400'
})

// === Cleanup ===
console.log()
console.log('=== Cleanup ===')
await probe('Delete smoke customer account', async () => {
  await db.deleteUser(customerEmail)
  return 'gone'
})

console.log()
const passes = results.filter((r) => r.status === 'PASS').length
const fails = results.length - passes
console.log(`=== ${passes}/${results.length} pass · ${fails} fail ===`)
server.close()
process.exit(fails === 0 ? 0 : 1)
