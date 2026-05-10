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

function fileDelete(key) {
  if (!fs.existsSync(KV_FILE)) return
  try {
    const data = JSON.parse(fs.readFileSync(KV_FILE, 'utf8')) || {}
    if (key in data) {
      delete data[key]
      fs.writeFileSync(KV_FILE, JSON.stringify(data, null, 2))
    }
  } catch (err) {
    console.warn('[db] file delete failed:', err.message)
  }
}

async function rawDelete(key) {
  if (useKv) {
    try {
      const k = await getKv()
      await k.del(key)
      return
    } catch (err) {
      console.warn('[db] KV del failed for', key, '— failing over to file:', err.message)
      fileDelete(key)
      return
    }
  }
  fileDelete(key)
}

// ---------- Key helpers ----------
const userKey = (email) => `${PREFIX}user:${normalizeEmail(email)}`
const userIndexKey = `${PREFIX}user-emails`
const ordersKey = `${PREFIX}orders`
const eventOverridesKey = `${PREFIX}event-overrides`
const eventSnapshotsKey = `${PREFIX}event-snapshots`
const adminEventsKey = `${PREFIX}admin-events`

// Generate a short, opaque, URL-safe id with the `adm-` prefix so the
// rest of the platform can dispatch admin-created events by id alone.
function newAdminEventId() {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 8)
  return `adm-${t}${r}`
}

// Fields we persist in event snapshots. Anything else is volatile / debug.
const SNAPSHOT_FIELDS = [
  'id',
  'providerId',
  'title',
  'category',
  'sport',
  'league',
  'venue',
  'city',
  'citySlug',
  'country',
  'image',
  'homeTeam',
  'awayTeam',
  'homeCrest',
  'awayCrest',
  'date',
  'utcDate',
  'price',
  'pricing',
  'badge',
  'badgeType',
  'provider',
]

// Merge a fresh live event into an existing snapshot. Non-empty fields
// from `fresh` win — that way the snapshot accumulates the richest data
// the provider has ever returned, and a temporary regression upstream
// (e.g. venue dropping) doesn't blank out the admin's view.
function mergeSnapshot(existing, fresh) {
  const out = { ...existing }
  for (const key of SNAPSHOT_FIELDS) {
    const value = fresh[key]
    if (value === '' || value === null || value === undefined) continue
    if (key === 'pricing' && typeof value === 'object') {
      out.pricing = { ...(existing.pricing || {}), ...value }
      continue
    }
    out[key] = value
  }
  return out
}

function snapshotsEqual(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  for (const key of SNAPSHOT_FIELDS) {
    const av = a[key]
    const bv = b[key]
    if (key === 'pricing') {
      const ap = av || {}
      const bp = bv || {}
      if (ap.standard !== bp.standard || ap.premium !== bp.premium || ap.vip !== bp.vip) {
        return false
      }
      continue
    }
    if ((av ?? '') !== (bv ?? '')) return false
  }
  return true
}

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

  /**
   * Returns the full user record for every email in the index. Strips
   * sensitive fields (password hash, OTP) so the admin UI can render
   * the list without leaking secrets. Records that fall out of sync
   * (email in index but no user record) are filtered out silently.
   */
  async listAllUsers() {
    const emails = (await rawGet(userIndexKey)) || []
    const out = []
    for (const email of emails) {
      const u = await rawGet(userKey(email))
      if (!u) continue
      // Whitelist safe fields; never expose the password hash or OTP.
      out.push({
        email: u.email,
        name: u.name || null,
        role: u.role || 'user',
        verified: !!u.verified,
        createdAt: u.createdAt || null,
        provider: u.provider || 'local',
      })
    }
    return out
  },

  /**
   * Hard-delete a user record + remove from the email index. Caller
   * is responsible for any policy checks (don't delete the seeded
   * admin, don't delete yourself). Returns true if the user existed
   * and was removed, false otherwise.
   */
  async deleteUser(email) {
    const norm = normalizeEmail(email)
    const existed = !!(await rawGet(userKey(norm)))
    await rawDelete(userKey(norm))
    const emails = (await rawGet(userIndexKey)) || []
    const next = emails.filter((e) => e !== norm)
    if (next.length !== emails.length) {
      await rawSet(userIndexKey, next)
    }
    return existed
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

  // ---------- Event overrides ----------
  // Live API events are immutable upstream, but admin can override any
  // surface field (title, image, venue, pricing tiers, etc). Overrides
  // are keyed by event id and merged onto the live event on every read.
  async listEventOverrides() {
    const list = (await rawGet(eventOverridesKey)) || []
    const map = {}
    for (const entry of list) {
      if (entry?.id) map[entry.id] = entry
    }
    return map
  },

  async getEventOverride(id) {
    const list = (await rawGet(eventOverridesKey)) || []
    return list.find((o) => o.id === id) || null
  },

  async setEventOverride(id, patch) {
    const list = (await rawGet(eventOverridesKey)) || []
    const idx = list.findIndex((o) => o.id === id)
    const existing = idx >= 0 ? list[idx] : {}
    const next = {
      ...existing,
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    }
    if (idx >= 0) list[idx] = next
    else list.push(next)
    await rawSet(eventOverridesKey, list)
    return next
  },

  async clearEventOverride(id) {
    const list = (await rawGet(eventOverridesKey)) || []
    const next = list.filter((o) => o.id !== id)
    await rawSet(eventOverridesKey, next)
  },

  // ---------- Event snapshots ----------
  // The snapshot store is the canonical record of every event the
  // platform has ever ingested from a live provider. Admin reads this so
  // the edit form is always pre-populated, even if the live API later
  // omits fields (e.g. football-data free tier rarely returns city).
  async listEventSnapshots() {
    const list = (await rawGet(eventSnapshotsKey)) || []
    const map = {}
    for (const entry of list) {
      if (entry?.id) map[entry.id] = entry
    }
    return map
  },

  async getEventSnapshot(id) {
    const list = (await rawGet(eventSnapshotsKey)) || []
    return list.find((e) => e.id === id) || null
  },

  // Bulk upsert: merge each event into the snapshot store, returning the
  // resulting map keyed by id. Only writes back if anything changed.
  async snapshotEvents(events) {
    const list = (await rawGet(eventSnapshotsKey)) || []
    const map = {}
    for (const entry of list) {
      if (entry?.id) map[entry.id] = entry
    }
    let changed = false
    const stamp = new Date().toISOString()
    for (const event of events || []) {
      if (!event?.id) continue
      const existing = map[event.id]
      const merged = mergeSnapshot(existing || {}, event)
      if (!existing || !snapshotsEqual(existing, merged)) {
        merged.snapshotAt = stamp
        map[event.id] = merged
        changed = true
      }
    }
    if (changed) {
      await rawSet(eventSnapshotsKey, Object.values(map))
    }
    return map
  },

  // ---------- Admin-created events ----------
  // Events the admin manually creates from the dashboard. Stored as
  // first-class records (not as overrides on a live event) — the admin
  // owns the data outright. They flow through the same applyOverride
  // pipeline as live events for any later edits, and join the relevant
  // category list endpoints alongside curated/live data.
  async listAdminEvents() {
    return (await rawGet(adminEventsKey)) || []
  },

  async getAdminEvent(id) {
    const list = await this.listAdminEvents()
    return list.find((e) => e.id === id) || null
  },

  async createAdminEvent(input) {
    const id = newAdminEventId()
    const now = new Date().toISOString()
    const event = {
      ...input,
      id,
      providerId: id,
      provider: 'admin-created',
      adminCreated: true,
      createdAt: now,
      updatedAt: now,
    }
    const list = await this.listAdminEvents()
    list.push(event)
    await rawSet(adminEventsKey, list)
    return event
  },

  async updateAdminEvent(id, patch) {
    const list = await this.listAdminEvents()
    const idx = list.findIndex((e) => e.id === id)
    if (idx < 0) return null
    list[idx] = {
      ...list[idx],
      ...patch,
      id: list[idx].id, // never overwrite identity
      providerId: list[idx].providerId,
      provider: list[idx].provider,
      adminCreated: true,
      createdAt: list[idx].createdAt,
      updatedAt: new Date().toISOString(),
    }
    await rawSet(adminEventsKey, list)
    return list[idx]
  },

  async deleteAdminEvent(id) {
    const list = await this.listAdminEvents()
    const next = list.filter((e) => e.id !== id)
    if (next.length === list.length) return false
    await rawSet(adminEventsKey, next)
    return true
  },
}
