import { Router } from 'express'
import { authMiddleware } from '../auth.js'
import { db } from '../db.js'
import { generateOrderId } from '../utils.js'

const router = Router()

router.post('/', authMiddleware, (req, res) => {
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

    user: (o.user || req.user.name || '').trim(),
    email: req.user.email.toLowerCase(),

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
  res.status(201).json({ ok: true, order })
})

router.get('/me', authMiddleware, (req, res) => {
  const orders = db.findOrdersByEmail(req.user.email)
  res.json({ orders })
})

export default router
