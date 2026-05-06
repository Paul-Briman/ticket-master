import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Vercel functions can only write to /tmp; locally use a project-relative folder.
// Note: /tmp is per-instance and ephemeral on Vercel — replace with KV/Postgres
// for true persistence in production.
const DATA_DIR = process.env.VERCEL
  ? '/tmp/tm-data'
  : path.join(__dirname, '..', 'data')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// In-memory cache shared across function invocations on the same instance.
// Survives warm starts within the same Node process.
const cache = (globalThis.__tmStore ??= {})

function pathFor(name) {
  return path.join(DATA_DIR, `${name}.json`)
}

function readCollection(name) {
  if (cache[name]) return cache[name]
  const file = pathFor(name)
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

function writeCollection(name, data) {
  cache[name] = data
  try {
    fs.writeFileSync(pathFor(name), JSON.stringify(data, null, 2))
  } catch (err) {
    console.warn(`[db] could not persist ${name} to disk:`, err.message)
  }
}

const norm = (s) => String(s || '').toLowerCase()

export const db = {
  // ---------- Users ----------
  findUserByEmail(email) {
    const target = norm(email)
    return readCollection('users').find((u) => norm(u.email) === target) || null
  },

  upsertUser(user) {
    const users = readCollection('users')
    const idx = users.findIndex((u) => norm(u.email) === norm(user.email))
    if (idx >= 0) users[idx] = user
    else users.push(user)
    writeCollection('users', users)
    return user
  },

  // ---------- Orders ----------
  listOrders() {
    return readCollection('orders')
  },

  findOrder(id) {
    return readCollection('orders').find((o) => o.id === id) || null
  },

  findOrdersByEmail(email) {
    const target = norm(email)
    return readCollection('orders').filter((o) => norm(o.email) === target)
  },

  insertOrder(order) {
    const orders = readCollection('orders')
    orders.unshift(order)
    writeCollection('orders', orders)
    return order
  },

  updateOrder(id, patch) {
    const orders = readCollection('orders')
    const idx = orders.findIndex((o) => o.id === id)
    if (idx < 0) return null
    orders[idx] = { ...orders[idx], ...patch }
    writeCollection('orders', orders)
    return orders[idx]
  },
}
