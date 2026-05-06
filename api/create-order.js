import { db } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import { generateOrderId } from '../lib/utils.js'
import { handleError, methodNotAllowed } from '../lib/seed.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

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

    db.insertOrder(order)
    return res.status(201).json({ ok: true, order })
  } catch (err) {
    return handleError(res, err, 'create-order')
  }
}
