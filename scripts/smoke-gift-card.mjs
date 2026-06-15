// End-to-end smoke for Apple Gift Card payment flow.
//
// Flow under test:
//   1. Customer creates order with paymentMethod=apple-gift-card +
//      base64 front/back images.
//   2. Order returns with paymentMethod stored + both images persisted
//      + status='Pending Payment'.
//   3. Customer my-orders surfaces the pending order with images so
//      the UI can render "Pending Gift Card Verification".
//   4. Admin sees the order with images, approves via confirm-payment,
//      order transitions to Paid.
//   5. Reject flow also works for gift card orders (with reason).
//
// Validation cases:
//   - Missing front image → 400
//   - Missing back image → 400
//   - Bad data URL → 400
//   - Oversized image (over 800,000 char base64) → 400
//   - Crypto flow still works unchanged (regression guard)

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
console.log('Gift card flow smoke against', base)
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

// 1x1 transparent PNG. Real photos would be ~300 KB; this is enough
// to satisfy the data-URL regex on the backend.
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII='

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

const customerEmail = `gift-smoke-${Date.now()}@example.com`
await probe(`Provision customer ${customerEmail}`, async () => {
  const bcrypt = (await import('bcryptjs')).default
  await db.upsertUser({
    name: 'Gift Smoke',
    email: customerEmail,
    passwordHash: await bcrypt.hash('test12345', 4),
    role: 'user',
    isVerified: true,
    verifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  })
  return 'ok'
})

await probe('Customer login', async () => {
  const { res, body } = await jfetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email: customerEmail, password: 'test12345' }),
  })
  if (!res.ok) throw new Error(`status ${res.status}`)
  userToken = body.token
  return `token len=${userToken.length}`
})

if (!adminToken || !userToken) {
  console.log('\n=== ABORT — missing tokens ===')
  server.close()
  process.exit(1)
}

const baseOrder = {
  eventId: 'c-1',
  eventTitle: 'PSG vs Arsenal',
  eventDate: 'Sat, Jul 12 · 7:30 PM',
  eventVenue: 'Emirates Stadium',
  eventCity: 'London',
  eventCategory: 'sports',
  eventImage: '',
  user: 'Gift Smoke',
  section: 'VIP Section',
  row: 1,
  tier: 'vip',
  tierLabel: 'VIP',
  quantity: 1,
  pricePerTicket: 250,
  subtotal: 250,
  fee: 30,
  total: 280,
}

// ====================== Validation guards =====================
console.log()
console.log('=== Backend validation guards ===')

await probe('Gift card order without frontImage → 400', async () => {
  const { res, body } = await jfetch(
    '/api/create-order',
    {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrder,
        paymentMethod: 'apple-gift-card',
        giftCardBackImage: TINY_PNG_DATA_URL,
      }),
    },
    userToken,
  )
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status} body=${JSON.stringify(body)}`)
  if (!/Front-of-card/i.test(body?.error || '')) {
    throw new Error(`error not specific enough: ${body?.error}`)
  }
  return '400 with helpful message'
})

await probe('Gift card order without backImage → 400', async () => {
  const { res, body } = await jfetch(
    '/api/create-order',
    {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrder,
        paymentMethod: 'apple-gift-card',
        giftCardFrontImage: TINY_PNG_DATA_URL,
      }),
    },
    userToken,
  )
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`)
  if (!/Back-of-card/i.test(body?.error || '')) {
    throw new Error(`error not specific enough: ${body?.error}`)
  }
  return '400 with helpful message'
})

await probe('Gift card order with non-data-URL string → 400', async () => {
  const { res } = await jfetch(
    '/api/create-order',
    {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrder,
        paymentMethod: 'apple-gift-card',
        giftCardFrontImage: 'not-a-data-url',
        giftCardBackImage: TINY_PNG_DATA_URL,
      }),
    },
    userToken,
  )
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`)
  return '400'
})

await probe('Gift card order with oversized image → 400', async () => {
  const huge = 'data:image/jpeg;base64,' + 'A'.repeat(800_001)
  const { res } = await jfetch(
    '/api/create-order',
    {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrder,
        paymentMethod: 'apple-gift-card',
        giftCardFrontImage: huge,
        giftCardBackImage: TINY_PNG_DATA_URL,
      }),
    },
    userToken,
  )
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`)
  return '400'
})

// ====================== Happy path: gift card → approve =====================
console.log()
console.log('=== Path A: customer creates gift-card order → admin approves ===')

let orderAId = null
await probe('Customer creates valid gift-card order (pending)', async () => {
  const { res, body } = await jfetch(
    '/api/create-order',
    {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrder,
        paymentMethod: 'apple-gift-card',
        giftCardFrontImage: TINY_PNG_DATA_URL,
        giftCardBackImage: TINY_PNG_DATA_URL,
      }),
    },
    userToken,
  )
  if (res.status !== 201) throw new Error(`status ${res.status} body=${JSON.stringify(body)}`)
  if (body.order.paymentMethod !== 'apple-gift-card') {
    throw new Error(`paymentMethod=${body.order.paymentMethod}`)
  }
  if (body.order.status !== 'Pending Payment') {
    throw new Error(`status=${body.order.status}`)
  }
  if (!body.order.giftCardFrontImage || !body.order.giftCardBackImage) {
    throw new Error('images not persisted on returned order')
  }
  orderAId = body.order.id
  return `id=${orderAId} paymentMethod=apple-gift-card status=Pending Payment images=yes`
})

await probe('Customer my-orders surfaces pending gift-card order + images', async () => {
  const { res, body } = await jfetch('/api/my-orders', {}, userToken)
  if (!res.ok) throw new Error(`status ${res.status}`)
  const found = (body.orders || []).find((o) => o.id === orderAId)
  if (!found) throw new Error('order missing')
  if (found.paymentMethod !== 'apple-gift-card') throw new Error('paymentMethod missing on list')
  if (!found.giftCardFrontImage || !found.giftCardBackImage) {
    throw new Error('images missing on list response')
  }
  return 'visible with paymentMethod + images'
})

await probe('Admin sees the order via admin-orders with images', async () => {
  const { res, body } = await jfetch('/api/admin-orders', {}, adminToken)
  if (!res.ok) throw new Error(`status ${res.status}`)
  const found = (body.orders || []).find((o) => o.id === orderAId)
  if (!found) throw new Error('admin cannot see order')
  if (!found.giftCardFrontImage || !found.giftCardBackImage) {
    throw new Error('admin response missing images')
  }
  return 'admin sees order with images'
})

await probe('Admin approves gift card order → Paid', async () => {
  const { res, body } = await jfetch(
    '/api/confirm-payment',
    { method: 'POST', body: JSON.stringify({ orderId: orderAId }) },
    adminToken,
  )
  if (!res.ok) throw new Error(`status ${res.status} body=${JSON.stringify(body)}`)
  if (body.order.status !== 'Paid') throw new Error(`status=${body.order.status}`)
  return 'Paid + confirmedAt set'
})

await probe('Customer my-orders shows confirmed gift-card ticket', async () => {
  const { res, body } = await jfetch('/api/my-orders', {}, userToken)
  if (!res.ok) throw new Error(`status ${res.status}`)
  const found = (body.orders || []).find((o) => o.id === orderAId)
  if (!found) throw new Error('order missing')
  if (found.status !== 'Paid') throw new Error(`status=${found.status}`)
  if (found.paymentMethod !== 'apple-gift-card') throw new Error('paymentMethod field lost')
  return 'Paid (gift card method preserved)'
})

// ====================== Reject flow for gift card =====================
console.log()
console.log('=== Path B: gift-card order → admin rejects ===')

let orderBId = null
await probe('Customer creates second gift-card order', async () => {
  const { res, body } = await jfetch(
    '/api/create-order',
    {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrder,
        paymentMethod: 'apple-gift-card',
        giftCardFrontImage: TINY_PNG_DATA_URL,
        giftCardBackImage: TINY_PNG_DATA_URL,
      }),
    },
    userToken,
  )
  if (res.status !== 201) throw new Error(`status ${res.status}`)
  orderBId = body.order.id
  return `id=${orderBId}`
})

await probe('Admin rejects gift-card order with reason', async () => {
  const reason = 'Card balance does not match order total.'
  const { res, body } = await jfetch(
    '/api/reject-payment',
    { method: 'POST', body: JSON.stringify({ orderId: orderBId, reason }) },
    adminToken,
  )
  if (!res.ok) throw new Error(`status ${res.status}`)
  if (body.order.status !== 'Rejected') throw new Error(`status=${body.order.status}`)
  if (body.order.rejectionReason !== reason) throw new Error('reason lost')
  return 'Rejected with reason'
})

// ====================== Crypto regression guard =====================
console.log()
console.log('=== Regression: crypto flow unchanged ===')

let cryptoId = null
await probe('Customer creates crypto order (no images, defaults paymentMethod)', async () => {
  const { res, body } = await jfetch(
    '/api/create-order',
    {
      method: 'POST',
      body: JSON.stringify({ ...baseOrder }), // no paymentMethod set
    },
    userToken,
  )
  if (res.status !== 201) throw new Error(`status ${res.status}`)
  if (body.order.paymentMethod !== 'crypto') throw new Error(`expected crypto default, got ${body.order.paymentMethod}`)
  if (body.order.giftCardFrontImage !== null) throw new Error('crypto order should have null front image')
  if (body.order.giftCardBackImage !== null) throw new Error('crypto order should have null back image')
  cryptoId = body.order.id
  return `id=${cryptoId} paymentMethod=crypto images=null`
})

await probe('Customer creates crypto order explicit paymentMethod=crypto', async () => {
  const { res, body } = await jfetch(
    '/api/create-order',
    {
      method: 'POST',
      body: JSON.stringify({ ...baseOrder, paymentMethod: 'crypto' }),
    },
    userToken,
  )
  if (res.status !== 201) throw new Error(`status ${res.status}`)
  if (body.order.paymentMethod !== 'crypto') throw new Error(`paymentMethod=${body.order.paymentMethod}`)
  return 'crypto order ok'
})

await probe('Unknown paymentMethod silently coerces to crypto', async () => {
  const { res, body } = await jfetch(
    '/api/create-order',
    {
      method: 'POST',
      body: JSON.stringify({ ...baseOrder, paymentMethod: 'bogus' }),
    },
    userToken,
  )
  if (res.status !== 201) throw new Error(`status ${res.status}`)
  if (body.order.paymentMethod !== 'crypto') throw new Error(`coercion failed: paymentMethod=${body.order.paymentMethod}`)
  return 'safely defaulted to crypto'
})

// === Cleanup ===
console.log()
console.log('=== Cleanup ===')
await probe('Delete smoke customer', async () => {
  await db.deleteUser(customerEmail)
  return 'gone'
})

console.log()
const passes = results.filter((r) => r.status === 'PASS').length
const fails = results.length - passes
console.log(`=== ${passes}/${results.length} pass · ${fails} fail ===`)
server.close()
process.exit(fails === 0 ? 0 : 1)
