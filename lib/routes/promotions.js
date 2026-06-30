// Promotions API.
//
//   GET    /api/promotions                  → public; every promotion
//                                             with derived status. Used
//                                             by the frontend admin UI
//                                             and by anywhere that
//                                             needs to introspect a
//                                             promo (rare — most UI
//                                             just reads `event.promotion`
//                                             off the event itself).
//   GET    /api/admin/promotions            → admin alias (same data
//                                             but locked behind admin
//                                             auth so the listing tab
//                                             can require auth).
//   POST   /api/admin/promotions            → create
//   PATCH  /api/admin/promotions/:id        → edit
//   POST   /api/admin/promotions/:id/clone  → duplicate
//   DELETE /api/admin/promotions/:id        → hard delete
//
// The "apply this promo to event pricing" path does NOT live here —
// that's lib/util/promotionEngine.applyPromotionsToList(), called
// from every public event-list/detail endpoint after admin overrides
// and the expiry filter.

import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'
import { handleError } from '../seed.js'
import {
  derivePromotionStatus,
  normalizePromotionInput,
  defaultWorldCupPromotion,
} from '../util/promotionEngine.js'

const router = Router()

// Lazy seed of the default World Cup Knockout Sale. Runs at most
// once per database — the marker key prevents recreation after an
// admin deletes the seeded promotion. Called from every read path
// that touches promotions.
async function ensurePromotionsSeeded() {
  if (await db.isPromotionsSeeded()) return
  const existing = await db.listPromotions()
  if (existing.length === 0) {
    await db.savePromotion(defaultWorldCupPromotion(new Date()))
    console.log('[promotions] seeded default World Cup Knockout Sale')
  }
  await db.markPromotionsSeeded()
}

function decorate(promotion, now = Date.now()) {
  return { ...promotion, status: derivePromotionStatus(promotion, now) }
}

// ---------- Public ----------
// No auth — the frontend reads this to render the admin promotions
// table once admin is logged in (the auth check happens on the admin
// alias). Also useful for any tooling that wants to introspect.
router.get('/promotions', async (_req, res) => {
  try {
    await ensurePromotionsSeeded()
    const list = await db.listPromotions()
    const now = Date.now()
    const decorated = list.map((p) => decorate(p, now))
    return res.status(200).json({ promotions: decorated, count: decorated.length })
  } catch (err) {
    return handleError(res, err, 'promotions-list')
  }
})

// ---------- Admin namespace ----------
// All routes below require admin auth — the middleware short-circuits
// non-admin requests with 401/403 before any DB access.
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
    await ensurePromotionsSeeded()
    const list = await db.listPromotions()
    const now = Date.now()
    const decorated = list.map((p) => decorate(p, now))
    return res.status(200).json({ promotions: decorated, count: decorated.length })
  } catch (err) {
    return handleError(res, err, 'admin-promotions-list')
  }
})

admin.post('/', async (req, res) => {
  try {
    const result = normalizePromotionInput(req.body)
    if (!result.ok) return res.status(400).json({ error: result.error })
    await db.savePromotion(result.promotion)
    return res.status(201).json({ ok: true, promotion: decorate(result.promotion) })
  } catch (err) {
    return handleError(res, err, 'admin-promotions-create')
  }
})

admin.patch('/:id', async (req, res) => {
  try {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'id required' })
    const existing = await db.getPromotion(id)
    if (!existing) return res.status(404).json({ error: 'Promotion not found' })

    // Merge the patch onto the existing record, then validate the
    // whole thing. This lets the admin send a partial update (e.g.
    // just the endsAt) without re-sending all required fields.
    const merged = {
      ...existing,
      ...req.body,
      appliesTo: req.body?.appliesTo || existing.appliesTo,
    }
    const result = normalizePromotionInput(merged, existing)
    if (!result.ok) return res.status(400).json({ error: result.error })
    await db.savePromotion(result.promotion)
    return res.status(200).json({ ok: true, promotion: decorate(result.promotion) })
  } catch (err) {
    return handleError(res, err, 'admin-promotions-update')
  }
})

admin.post('/:id/clone', async (req, res) => {
  try {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'id required' })
    const existing = await db.getPromotion(id)
    if (!existing) return res.status(404).json({ error: 'Promotion not found' })

    // Strip the source id + timestamps so normalizePromotionInput
    // mints a fresh id. Name gets a "(Copy)" suffix so admins can
    // tell them apart in the list.
    const { id: _src, createdAt: _c, updatedAt: _u, ...rest } = existing
    const result = normalizePromotionInput({
      ...rest,
      name: `${existing.name} (Copy)`,
      enabled: false, // duplicates start disabled so an accidental clone doesn't double-discount
    })
    if (!result.ok) return res.status(400).json({ error: result.error })
    await db.savePromotion(result.promotion)
    return res.status(201).json({ ok: true, promotion: decorate(result.promotion) })
  } catch (err) {
    return handleError(res, err, 'admin-promotions-clone')
  }
})

admin.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'id required' })
    const removed = await db.deletePromotion(id)
    if (!removed) return res.status(404).json({ error: 'Promotion not found' })
    return res.status(200).json({ ok: true })
  } catch (err) {
    return handleError(res, err, 'admin-promotions-delete')
  }
})

router.use('/admin/promotions', admin)

// Export the seeder so list/detail routes can pre-warm before
// applying promotions (avoids a "first request returns no promo"
// race after a fresh deploy).
export { ensurePromotionsSeeded }
export default router
