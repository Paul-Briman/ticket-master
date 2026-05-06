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

// File fallback. Vercel only allows writes to /tmp, so on Vercel without KV
// data is per-instance and ephemeral — KV is the right answer for production.
const DATA_DIR = process.env.VERCEL
  ? '/tmp/tm-data'
  : path.join(__dirname, '..', 'data')

if (!useKv) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  } catch {
    // ignore
  }
  if (process.env.VERCEL && !globalThis.__tmKvWarning) {
    globalThis.__tmKvWarning = true
    console.warn(
      '[db] WARNING: running on Vercel without KV. Data will NOT persist across serverless instances. ' +
        'Provision Vercel KV in the dashboard (Storage → Connect Database → Upstash Redis) to fix.',
    )
  }
}

function fileFor(name) {
  return path.join(DATA_DIR, `${name}.json`)
}

async function readCollection(name) {
  if (useKv) {
    const k = await getKv()
    const data = await k.get(`${PREFIX}${name}`)
    return Array.isArray(data) ? data : []
  }
  // Always read fresh from disk — no in-memory cache.
  const file = fileFor(name)
  if (!fs.existsSync(file)) return []
  try {
    const raw = fs.readFileSync(file, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.warn(`[db] could not read ${name}:`, err.message)
    return []
  }
}

async function writeCollection(name, data) {
  if (useKv) {
    const k = await getKv()
    await k.set(`${PREFIX}${name}`, data)
    return
  }
  // Always write to disk after every update.
  try {
    fs.writeFileSync(fileFor(name), JSON.stringify(data, null, 2))
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
