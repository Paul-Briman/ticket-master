import { db } from '../lib/db.js'
import { requireAuth, requireAdmin } from '../lib/auth.js'
import { sendEmail } from '../lib/email.js'
import { ticketEmail } from '../lib/templates/ticket.js'
import { handleError, methodNotAllowed } from '../lib/seed.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  try {
    const auth = requireAuth(req)
    requireAdmin(auth)

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

    return res.status(200).json({ ok: true, order: updated })
  } catch (err) {
    return handleError(res, err, 'confirm-payment')
  }
}
