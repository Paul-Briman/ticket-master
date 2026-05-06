import { Router } from 'express'
import { authMiddleware, adminMiddleware } from '../auth.js'
import { db } from '../db.js'
import { sendEmail } from '../email.js'
import { ticketEmail } from '../templates/ticket.js'

const router = Router()

router.use(authMiddleware, adminMiddleware)

router.get('/orders', (_req, res) => {
  const orders = db.listOrders()
  res.json({ orders })
})

router.post('/confirm-payment', async (req, res, next) => {
  try {
    const { orderId } = req.body || {}
    if (!orderId) return res.status(400).json({ error: 'orderId is required' })

    const order = db.findOrder(orderId)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.status === 'Paid') {
      return res.status(409).json({ error: 'Order is already confirmed' })
    }

    const updated = db.updateOrder(orderId, {
      status: 'Paid',
      confirmedAt: new Date().toISOString(),
    })

    await sendEmail({
      to: order.email,
      subject: 'Your Ticket is Confirmed',
      html: ticketEmail({ order: updated }),
      text: `Your ticket for ${order.eventTitle} is confirmed. Order ID: ${order.id}`,
    })

    res.json({ ok: true, order: updated })
  } catch (err) {
    next(err)
  }
})

export default router
