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

function pathFor(name) {
  return path.join(DATA_DIR, `${name}.json`)
}

function readCollection(name) {
  const file = pathFor(name)
  if (!fs.existsSync(file)) return []
  try {
    const raw = fs.readFileSync(file, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeCollection(name, data) {
  fs.writeFileSync(pathFor(name), JSON.stringify(data, null, 2))
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

  // ---------- OTPs ----------
  upsertOtp(record) {
    const otps = readCollection('otps')
    const idx = otps.findIndex(
      (o) => norm(o.email) === norm(record.email) && o.purpose === record.purpose,
    )
    if (idx >= 0) otps[idx] = record
    else otps.push(record)
    writeCollection('otps', otps)
  },

  findOtp(email, purpose) {
    return (
      readCollection('otps').find(
        (o) => norm(o.email) === norm(email) && o.purpose === purpose,
      ) || null
    )
  },

  deleteOtp(email, purpose) {
    const otps = readCollection('otps').filter(
      (o) => !(norm(o.email) === norm(email) && o.purpose === purpose),
    )
    writeCollection('otps', otps)
  },
}
