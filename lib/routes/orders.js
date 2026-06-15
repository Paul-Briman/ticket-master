import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'
import { sendEmail } from '../email.js'
import { ticketEmail } from '../templates/ticket.js'
import { generateOrderId } from '../utils.js'
import { handleError } from '../seed.js'

const router = Router()

// Accepted payment methods. Backend stores the chosen method on the
// order so My Tickets and AdminOrders can branch UI without inferring
// from other fields. New methods only need to land here.
const PAYMENT_METHODS = new Set(['crypto', 'apple-gift-card'])

// Per-image base64 cap (≈ size in bytes of the encoded string).
// 800,000 chars × ~0.75 = ~600 KB of binary. Client-side compression
// targets ~300 KB, so this is the hard upper bound that protects KV
// from a malicious oversized payload.
const MAX_IMAGE_BASE64_CHARS = 800_000

function isValidDataUrlImage(s) {
  if (typeof s !== 'string') return false
  if (s.length === 0) return false
  if (s.length > MAX_IMAGE_BASE64_CHARS) return false
  return /^data:image\/(jpe?g|png|webp);base64,/.test(s)
}

router.post('/create-order', async (req, res) => {
  try {
    const auth = requireAuth(req)
    const o = req.body || {}

    if (!o.eventId || !o.eventTitle || !o.section) {
      return res.status(400).json({ error: 'Missing required order fields' })
    }

    const paymentMethod = PAYMENT_METHODS.has(o.paymentMethod)
      ? o.paymentMethod
      : 'crypto'

    // Apple Gift Card orders MUST include both photos. We validate
    // here so a malformed client never lands a stub order with no
    // proof of payment attached.
    let giftCardFrontImage = null
    let giftCardBackImage = null
    if (paymentMethod === 'apple-gift-card') {
      if (!isValidDataUrlImage(o.giftCardFrontImage)) {
        return res.status(400).json({
          error: 'Front-of-card image is required (JPEG / PNG / WebP, max ~500 KB).',
        })
      }
      if (!isValidDataUrlImage(o.giftCardBackImage)) {
        return res.status(400).json({
          error: 'Back-of-card image is required (JPEG / PNG / WebP, max ~500 KB).',
        })
      }
      giftCardFrontImage = o.giftCardFrontImage
      giftCardBackImage = o.giftCardBackImage
    }

    const order = {
      id: generateOrderId(),
      createdAt: new Date().toISOString(),
      status: 'Pending Payment',
      paymentMethod,

      eventId: o.eventId,
      eventTitle: o.eventTitle,
      eventDate: o.eventDate || '',
      eventVenue: o.eventVenue || '',
      eventCity: o.eventCity || '',
      eventCategory: o.eventCategory || '',
      eventImage: o.eventImage || '',

      user: (o.user || auth.name || '').trim(),
      email: auth.email.toLowerCase(),

      section: o.section,
      row: o.row ?? null,
      tier: o.tier || '',
      tierLabel: o.tierLabel || '',
      quantity: Number(o.quantity) || 1,
      pricePerTicket: Number(o.pricePerTicket) || 0,
      subtotal: Number(o.subtotal) || 0,
      fee: Number(o.fee) || 0,
      total: Number(o.total) || 0,

      // Payment-method-specific payload. Only populated for the
      // gift-card flow; crypto orders keep these null so the row
      // doesn't carry meaningless empty strings.
      giftCardFrontImage,
      giftCardBackImage,
    }

    await db.insertOrder(order)
    return res.status(201).json({ ok: true, order })
  } catch (err) {
    return handleError(res, err, 'create-order')
  }
})

router.get('/my-orders', async (req, res) => {
  try {
    const auth = requireAuth(req)
    const orders = await db.findOrdersByEmail(auth.email)
    return res.status(200).json({ orders })
  } catch (err) {
    return handleError(res, err, 'my-orders')
  }
})

router.get('/admin-orders', async (req, res) => {
  try {
    const auth = requireAuth(req)
    requireAdmin(auth)
    const orders = await db.listOrders()
    return res.status(200).json({ orders })
  } catch (err) {
    return handleError(res, err, 'admin-orders')
  }
})

router.post('/confirm-payment', async (req, res) => {
  try {
    const auth = requireAuth(req)
    requireAdmin(auth)

    const { orderId } = req.body || {}
    if (!orderId) return res.status(400).json({ error: 'orderId is required' })

    const order = await db.findOrder(orderId)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    // Order states are terminal: an order in any non-pending state
    // (Paid or Rejected) cannot transition. If admin made a mistake,
    // they need to handle it manually instead of silently flipping a
    // confirmed ticket back to pending and back to paid.
    if (order.status === 'Paid') {
      return res.status(409).json({ error: 'Order is already confirmed' })
    }
    if (order.status === 'Rejected') {
      return res.status(409).json({
        error: 'Order was rejected. Reverse the rejection before confirming.',
      })
    }

    const updated = await db.updateOrder(orderId, {
      status: 'Paid',
      confirmedAt: new Date().toISOString(),
    })

    await sendEmail({
      to: order.email,
      subject: 'Your Ticket is Confirmed',
      html: ticketEmail({ order: updated }),
      text: `Your ticket for ${order.eventTitle} is confirmed. Order ID: ${order.id}`,
    })

    return res.status(200).json({ ok: true, order: updated })
  } catch (err) {
    return handleError(res, err, 'confirm-payment')
  }
})

// Admin can reject a pending payment when the on-chain transfer
// couldn't be verified. Symmetric with confirm-payment: terminal states
// are frozen. An optional `reason` is surfaced on the customer's My
// Tickets page so they know why their ticket wasn't issued.
router.post('/reject-payment', async (req, res) => {
  try {
    const auth = requireAuth(req)
    requireAdmin(auth)

    const { orderId, reason } = req.body || {}
    if (!orderId) return res.status(400).json({ error: 'orderId is required' })

    const order = await db.findOrder(orderId)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.status === 'Paid') {
      return res.status(409).json({
        error: 'Order is already confirmed — cannot reject a paid ticket.',
      })
    }
    if (order.status === 'Rejected') {
      return res.status(409).json({ error: 'Order is already rejected' })
    }

    // Normalise + cap the optional reason to keep the DB tidy.
    let trimmedReason = ''
    if (typeof reason === 'string') {
      trimmedReason = reason.trim().slice(0, 500)
    }

    const updated = await db.updateOrder(orderId, {
      status: 'Rejected',
      rejectedAt: new Date().toISOString(),
      rejectionReason: trimmedReason || null,
    })

    // No customer email — the My Tickets page surfaces the rejection
    // and reason inline. Admin can follow up out-of-band if needed.
    console.log('[reject-payment]', {
      id: orderId,
      by: auth.email,
      reason: trimmedReason || '(none)',
    })

    return res.status(200).json({ ok: true, order: updated })
  } catch (err) {
    return handleError(res, err, 'reject-payment')
  }
})

export default router
