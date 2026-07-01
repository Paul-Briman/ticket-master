// Homepage Sections API.
//
//   GET   /api/homepage-sections           → public; ordered list of
//                                            homepage lanes with their
//                                            enabled flag + display
//                                            limit. Homepage reads
//                                            this and renders in the
//                                            given order, skipping any
//                                            with enabled=false OR
//                                            zero fetched events.
//   GET   /api/admin/homepage-sections     → admin alias (same data,
//                                            auth-gated).
//   PATCH /api/admin/homepage-sections     → admin overwrites the
//                                            whole config array.
//                                            Validated + persisted.
//
// Only the shape { key, enabled, limit, order } is admin-editable.
// The `title` is a display constant on the frontend so admins can't
// break section identity by renaming a key mid-flight.
//
// New section keys can only be added via a code change (new frontend
// renderer must exist). Unknown keys posted by the admin are silently
// dropped by the validator.

import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'
import { handleError } from '../seed.js'

const router = Router()

// The canonical, unchangeable set of homepage section keys. Adding a
// new one is a code change (must have a matching renderer in Home.jsx).
// If admin PATCHes without a section, we fill it back in with default
// values so the config always contains ALL known sections.
const CANONICAL = [
  { key: 'world-cup-knockout', enabled: true, limit: 8 },
  { key: 'ucl', enabled: true, limit: 8 },
  { key: 'nba', enabled: true, limit: 8 },
  { key: 'featured-sports', enabled: true, limit: 8 },
  { key: 'concerts', enabled: true, limit: 8 },
  { key: 'arts', enabled: true, limit: 8 },
  { key: 'family', enabled: true, limit: 8 },
]

const KNOWN_KEYS = new Set(CANONICAL.map((s) => s.key))
const DISPLAY_LIMIT_MIN = 1
const DISPLAY_LIMIT_MAX = 20
const DISPLAY_LIMIT_DEFAULT = 8

function defaultSections() {
  return CANONICAL.map((s, order) => ({ ...s, order }))
}

// Normalize a partial admin payload into a full canonical array.
// - unknown keys dropped
// - missing keys re-added with defaults so the response always
//   contains every renderable section
// - order re-derived from array position (admin drag-reorder writes
//   the sections in their intended order)
// - limit clamped to [1, 20]
// Returns { ok: true, sections } or { ok: false, error }.
function normalizeSectionsInput(body) {
  if (!Array.isArray(body)) {
    return { ok: false, error: 'sections must be an array' }
  }

  const seen = new Set()
  const kept = []
  for (const s of body) {
    if (!s || typeof s !== 'object') continue
    const key = String(s.key || '')
    if (!KNOWN_KEYS.has(key) || seen.has(key)) continue
    seen.add(key)

    let limit = Number(s.limit)
    if (!Number.isFinite(limit)) limit = DISPLAY_LIMIT_DEFAULT
    limit = Math.max(DISPLAY_LIMIT_MIN, Math.min(DISPLAY_LIMIT_MAX, Math.floor(limit)))
    const enabled = s.enabled !== false

    kept.push({ key, enabled, limit })
  }

  // Append any canonical sections the admin omitted. This keeps the
  // response shape stable and lets the frontend always assume it has
  // an entry for every section without extra guards.
  for (const c of CANONICAL) {
    if (!seen.has(c.key)) kept.push({ ...c })
  }

  return {
    ok: true,
    sections: kept.map((s, order) => ({ ...s, order })),
  }
}

// Lazy default seed. Runs the first time the endpoint is hit after a
// fresh deploy — writes the default set to KV so admin CRUD works
// against a persisted record from that point onward. Idempotent: if a
// config already exists, return it untouched.
async function ensureSectionsSeeded() {
  const existing = await db.getHomepageSections()
  if (Array.isArray(existing) && existing.length > 0) return existing
  const seed = defaultSections()
  await db.saveHomepageSections(seed)
  console.log('[homepage-sections] seeded default config')
  return seed
}

// ---------- Public ----------
router.get('/homepage-sections', async (_req, res) => {
  try {
    const sections = await ensureSectionsSeeded()
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30')
    return res.status(200).json({ sections, count: sections.length })
  } catch (err) {
    return handleError(res, err, 'homepage-sections-get')
  }
})

// ---------- Admin ----------
const admin = Router()
admin.use((req, res, next) => {
  try {
    const user = requireAuth(req)
    requireAdmin(user)
    req.adminUser = user
    next()
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message })
  }
})

admin.get('/', async (_req, res) => {
  try {
    const sections = await ensureSectionsSeeded()
    return res.status(200).json({ sections, count: sections.length })
  } catch (err) {
    return handleError(res, err, 'admin-homepage-sections-get')
  }
})

admin.patch('/', async (req, res) => {
  try {
    const result = normalizeSectionsInput(req.body?.sections ?? req.body)
    if (!result.ok) return res.status(400).json({ error: result.error })
    await db.saveHomepageSections(result.sections)
    return res.status(200).json({ ok: true, sections: result.sections })
  } catch (err) {
    return handleError(res, err, 'admin-homepage-sections-patch')
  }
})

router.use('/admin/homepage-sections', admin)

export {
  DISPLAY_LIMIT_MIN,
  DISPLAY_LIMIT_MAX,
  DISPLAY_LIMIT_DEFAULT,
  defaultSections,
  normalizeSectionsInput,
}
export default router
