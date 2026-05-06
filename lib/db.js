import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeEmail } from './utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const useKv = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
const PREFIX = 'tm:'

console.log('[db] KV ENABLED:', useKv)
if (!useKv && process.env.VERCEL && !globalThis.__tmKvWarned) {
  globalThis.__tmKvWarned = true
  console.warn(
    '[db] WARNING: Vercel KV not configured. Provision Vercel KV (Storage → ' +
      'Marketplace Database Providers → Upstash for Redis) and redeploy. ' +
      'File storage at /tmp will NOT persist across serverless instances.',
  )
}

let kvClient = null
async function getKv() {
  if (!kvClient) {
    const mod = await import('@vercel/kv')
    kvClient = mod.kv
  }
  return kvClient
}

// File fallback. Vercel only allows writes to /tmp.
const DATA_DIR = process.env.VERCEL
  ? '/tmp/tm-data'
  : path.join(__dirname, '..', 'data')

if (!useKv) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  } catch {
    // ignore
  }
}

const KV_FILE = path.join(DATA_DIR, 'kv.json')

function fileGet(key) {
  if (!fs.existsSync(KV_FILE)) return null
  try {
    const raw = fs.readFileSync(KV_FILE, 'utf8')
    const data = JSON.parse(raw)
    return key in data ? data[key] : null
  } catch {
    return null
  }
}

function fileSet(key, value) {
  let data = {}
  if (fs.existsSync(KV_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(KV_FILE, 'utf8')) || {}
    } catch {
      data = {}
    }
  }
  data[key] = value
  try {
    fs.writeFileSync(KV_FILE, JSON.stringify(data, null, 2))
  } catch (err) {
    console.warn('[db] could not persist to file:', err.message)
  }
}

async function rawGet(key) {
  if (useKv) {
    try {
      const k = await getKv()
      return await k.get(key)
    } catch (err) {
      console.warn('[db] KV get failed for', key, '— failing over to file:', err.message)
      return fileGet(key)
    }
  }
  return fileGet(key)
}

async function rawSet(key, value) {
  if (useKv) {
    try {
      const k = await getKv()
      await k.set(key, value)
      return
    } catch (err) {
      console.warn('[db] KV set failed for', key, '— failing over to file:', err.message)
      fileSet(key, value)
      return
    }
  }
  fileSet(key, value)
}

// ---------- Key helpers ----------
const userKey = (email) => `${PREFIX}user:${normalizeEmail(email)}`
const userIndexKey = `${PREFIX}user-emails`
const ordersKey = `${PREFIX}orders`

// ---------- Public API ----------
export const db = {
  isKv: useKv,

  // Users
  async findUserByEmail(email) {
    const key = userKey(email)
    return await rawGet(key)
  },

  async upsertUser(user) {
    const norm = normalizeEmail(user.email)
    const stored = { ...user, email: norm }
    await rawSet(userKey(norm), stored)

    // Maintain index of all emails for getAllUserEmails / debugging
    const emails = (await rawGet(userIndexKey)) || []
    if (!emails.includes(norm)) {
      emails.push(norm)
      await rawSet(userIndexKey, emails)
    }
    return stored
  },

  async getAllUserEmails() {
    return (await rawGet(userIndexKey)) || []
  },

  // Orders
  async listOrders() {
    return (await rawGet(ordersKey)) || []
  },

  async findOrder(id) {
    const orders = await db.listOrders()
    return orders.find((o) => o.id === id) || null
  },

  async findOrdersByEmail(email) {
    const target = normalizeEmail(email)
    const orders = await db.listOrders()
    return orders.filter((o) => normalizeEmail(o.email) === target)
  },

  async insertOrder(order) {
    const orders = await db.listOrders()
    orders.unshift(order)
    await rawSet(ordersKey, orders)
    return order
  },

  async updateOrder(id, patch) {
    const orders = await db.listOrders()
    const idx = orders.findIndex((o) => o.id === id)
    if (idx < 0) return null
    orders[idx] = { ...orders[idx], ...patch }
    await rawSet(ordersKey, orders)
    return orders[idx]
  },
}
