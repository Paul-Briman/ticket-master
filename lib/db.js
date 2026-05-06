import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const useKv = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)

const PREFIX = 'tm:'

let kvClient = null
async function getKv() {
  if (!kvClient) {
    const mod = await import('@vercel/kv')
    kvClient = mod.kv
  }
  return kvClient
}

// File fallback (used in local dev and as a safety net on Vercel without KV).
// Vercel only allows writes to /tmp; locally we use a project-level data dir.
const DATA_DIR = process.env.VERCEL
  ? '/tmp/tm-data'
  : path.join(__dirname, '..', 'data')

if (!useKv && !fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  } catch {
    // ignore — read paths handle missing dir
  }
}

const cache = (globalThis.__tmStore ??= {})

async function readCollection(name) {
  if (useKv) {
    const k = await getKv()
    const data = await k.get(`${PREFIX}${name}`)
    return Array.isArray(data) ? data : []
  }
  if (cache[name]) return cache[name]
  const file = path.join(DATA_DIR, `${name}.json`)
  if (!fs.existsSync(file)) {
    cache[name] = []
    return cache[name]
  }
  try {
    const raw = fs.readFileSync(file, 'utf8')
    const parsed = JSON.parse(raw)
    cache[name] = Array.isArray(parsed) ? parsed : []
  } catch {
    cache[name] = []
  }
  return cache[name]
}

async function writeCollection(name, data) {
  if (useKv) {
    const k = await getKv()
    await k.set(`${PREFIX}${name}`, data)
    return
  }
  cache[name] = data
  try {
    fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2))
  } catch (err) {
    console.warn(`[db] could not persist ${name}:`, err.message)
  }
}

const norm = (s) => String(s || '').toLowerCase()

export const db = {
  isKv: useKv,

  // ---------- Users ----------
  async findUserByEmail(email) {
    const users = await readCollection('users')
    const target = norm(email)
    return users.find((u) => norm(u.email) === target) || null
  },

  async upsertUser(user) {
    const users = await readCollection('users')
    const idx = users.findIndex((u) => norm(u.email) === norm(user.email))
    if (idx >= 0) users[idx] = user
    else users.push(user)
    await writeCollection('users', users)
    return user
  },

  // ---------- Orders ----------
  async listOrders() {
    return await readCollection('orders')
  },

  async findOrder(id) {
    const orders = await readCollection('orders')
    return orders.find((o) => o.id === id) || null
  },

  async findOrdersByEmail(email) {
    const orders = await readCollection('orders')
    const target = norm(email)
    return orders.filter((o) => norm(o.email) === target)
  },

  async insertOrder(order) {
    const orders = await readCollection('orders')
    orders.unshift(order)
    await writeCollection('orders', orders)
    return order
  },

  async updateOrder(id, patch) {
    const orders = await readCollection('orders')
    const idx = orders.findIndex((o) => o.id === id)
    if (idx < 0) return null
    orders[idx] = { ...orders[idx], ...patch }
    await writeCollection('orders', orders)
    return orders[idx]
  },
}
