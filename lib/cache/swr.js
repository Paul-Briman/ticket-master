// Stale-while-revalidate cache layer.
// Layered: in-memory (per-instance) → Vercel KV (shared) → fresh fetch.
//
// On a hit within TTL: return immediately, no fetch.
// On a stale hit (TTL expired but within stale window): return stale data
//   immediately AND kick off a background refresh.
// On a miss: fetch fresh and populate both caches.
//
// Concurrent callers for the same key share one in-flight promise.

const useKv = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)

let kvClient = null
async function getKv() {
  if (!kvClient) {
    const mod = await import('@vercel/kv')
    kvClient = mod.kv
  }
  return kvClient
}

// Map<key, { data, expiresAt, staleUntil }>
const memoryCache = new Map()
// Map<key, Promise>
const inflight = new Map()

async function readKv(key) {
  if (!useKv) return null
  try {
    const k = await getKv()
    return await k.get(key)
  } catch (err) {
    console.warn('[swr] KV read failed', key, err.message)
    return null
  }
}

async function writeKv(key, entry, ttlSeconds) {
  if (!useKv) return
  try {
    const k = await getKv()
    await k.set(key, entry, { ex: ttlSeconds })
  } catch (err) {
    console.warn('[swr] KV write failed', key, err.message)
  }
}

async function refresh(key, freshFn, ttlSeconds, staleSeconds) {
  try {
    const data = await freshFn()
    const now = Date.now()
    const entry = {
      data,
      expiresAt: now + ttlSeconds * 1000,
      staleUntil: now + staleSeconds * 1000,
    }
    memoryCache.set(key, entry)
    await writeKv(key, entry, staleSeconds) // KV TTL = full stale window
    return data
  } finally {
    inflight.delete(key)
  }
}

/**
 * @param {string} key
 * @param {() => Promise<any>} freshFn
 * @param {object} [opts]
 * @param {number} [opts.ttlSeconds=600]      Fresh window (default 10 min)
 * @param {number} [opts.staleSeconds=1800]   Stale-but-usable window (default 30 min)
 * @returns {Promise<{ data: any, source: 'memory'|'kv'|'stale'|'fresh'|'inflight' }>}
 */
export async function swr(key, freshFn, opts = {}) {
  const ttlSeconds = opts.ttlSeconds ?? 600
  const staleSeconds = opts.staleSeconds ?? Math.max(ttlSeconds * 3, 1800)
  const now = Date.now()

  // Memory layer
  let entry = memoryCache.get(key)
  if (entry && entry.expiresAt > now) {
    return { data: entry.data, source: 'memory' }
  }

  // KV layer
  const kvEntry = await readKv(key)
  if (kvEntry?.expiresAt && kvEntry.expiresAt > now) {
    memoryCache.set(key, kvEntry)
    return { data: kvEntry.data, source: 'kv' }
  }

  // Stale window: serve stale, refresh in background
  const staleEntry = (entry?.staleUntil > now ? entry : null) ||
    (kvEntry?.staleUntil > now ? kvEntry : null)
  if (staleEntry) {
    if (!inflight.has(key)) {
      inflight.set(key, refresh(key, freshFn, ttlSeconds, staleSeconds).catch(
        (err) => {
          console.warn('[swr] background refresh failed', key, err.message)
          return staleEntry.data
        },
      ))
    }
    return { data: staleEntry.data, source: 'stale' }
  }

  // Cold path: deduped fresh fetch
  let promise = inflight.get(key)
  if (!promise) {
    promise = refresh(key, freshFn, ttlSeconds, staleSeconds)
    inflight.set(key, promise)
  }
  const data = await promise
  return { data, source: 'fresh' }
}
