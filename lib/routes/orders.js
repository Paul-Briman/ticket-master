import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'
import { sendEmail } from '../email.js'
import { ticketEmail } from '../templates/ticket.js'
import { generateOrderId } from '../utils.js'
import { handleError } from '../seed.js'

const router = Router()

router.post('/create-order', async (req, res) => {
  try {
    const auth = requireAuth(req)
    const o = req.body || {}

    if (!o.eventId || !o.eventTitle || !o.section) {
      return res.status(400).json({ error: 'Missing required order fields' })
    }

    const order = {
      id: generateOrderId(),
      createdAt: new Date().toISOString(),
      status: 'Pending Payment',

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
