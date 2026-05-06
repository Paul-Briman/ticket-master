import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { EVENTS } from '../data/events.js'
import { categoryImg, CATEGORY_TAGS } from './image.js'
import { toSlug } from './slug.js'
import { getSeatOptions, SERVICE_FEE_RATE } from './price.js'

const EVENTS_KEY = 'tm_admin_events'
const ORDERS_KEY = 'tm_admin_orders_v2'

const ORDER_STATUS = {
  PENDING: 'Pending Payment',
  PAID: 'Paid',
}

const AdminStoreContext = createContext(null)

function readEvents() {
  try {
    const raw = localStorage.getItem(EVENTS_KEY)
    if (!raw) return EVENTS
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : EVENTS
  } catch {
    return EVENTS
  }
}

function writeEvents(events) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events))
}

const SEED_USERS = [
  { name: 'Jordan Lee', email: 'jordan@example.com' },
  { name: 'Maya Patel', email: 'maya@example.com' },
  { name: 'Carlos Rivera', email: 'carlos@example.com' },
  { name: 'Aisha Khan', email: 'aisha@example.com' },
  { name: 'Ethan Brooks', email: 'ethan@example.com' },
]

function buildSeedOrders(events) {
  return events.slice(0, 6).map((event, i) => {
    const user = SEED_USERS[i % SEED_USERS.length]
    const qty = (i % 3) + 1
    const options = getSeatOptions(event)
    const option = options[i % options.length] || {
      section: 'Section A',
      row: 12,
      tier: 'standard',
      tierLabel: 'Standard',
      price: 80,
    }
    const subtotal = option.price * qty
    const fee = subtotal * SERVICE_FEE_RATE
    const total = subtotal + fee
    const isPaid = i % 3 !== 0

    return {
      id: `ord-seed-${i + 1}`,
      createdAt: new Date(Date.now() - (i + 1) * 36e5).toISOString(),
      eventId: event.id,
      eventTitle: event.title,
      eventDate: event.date,
      eventVenue: event.venue || '',
      eventCity: event.city,
      eventCategory: event.category,
      user: user.name,
      email: user.email,
      section: option.section,
      row: option.row,
      tier: option.tier,
      tierLabel: option.tierLabel,
      quantity: qty,
      pricePerTicket: option.price,
      subtotal,
      fee,
      total,
      status: isPaid ? ORDER_STATUS.PAID : ORDER_STATUS.PENDING,
      confirmedAt: isPaid
        ? new Date(Date.now() - (i + 1) * 18e5).toISOString()
        : null,
    }
  })
}

function readOrders(events) {
  try {
    const raw = localStorage.getItem(ORDERS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // ignore
  }
  const seeded = buildSeedOrders(events)
  localStorage.setItem(ORDERS_KEY, JSON.stringify(seeded))
  return seeded
}

export function defaultImageForCategory(category) {
  const tags = CATEGORY_TAGS[category] || 'event'
  const lock = Math.floor(Math.random() * 900) + 100
  return categoryImg(tags, { w: 600, h: 450, lock })
}

export function AdminStoreProvider({ children }) {
  const [events, setEvents] = useState(() => readEvents())
  const [orders, setOrders] = useState(() => readOrders(readEvents()))

  useEffect(() => {
    writeEvents(events)
  }, [events])

  useEffect(() => {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
  }, [orders])

  const value = useMemo(
    () => ({
      events,
      orders,
      createEvent(data) {
        const id = data.id || `ev-${Date.now()}`
        const next = { ...data, id, citySlug: toSlug(data.city || '') }
        setEvents((prev) => [next, ...prev])
      },
      updateEvent(id, data) {
        setEvents((prev) =>
          prev.map((e) =>
            e.id === id
              ? { ...e, ...data, citySlug: toSlug(data.city || e.city || '') }
              : e,
          ),
        )
      },
      deleteEvent(id) {
        setEvents((prev) => prev.filter((e) => e.id !== id))
      },
      resetEvents() {
        localStorage.removeItem(EVENTS_KEY)
        setEvents(EVENTS)
      },
      createOrder(order) {
        const id = order.id || `ord-${Date.now()}`
        const next = {
          createdAt: new Date().toISOString(),
          status: ORDER_STATUS.PENDING,
          ...order,
          id,
        }
        setOrders((prev) => [next, ...prev])
        return next
      },
      confirmOrder(id) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === id
              ? {
                  ...o,
                  status: ORDER_STATUS.PAID,
                  confirmedAt: new Date().toISOString(),
                }
              : o,
          ),
        )
      },
      getOrder(id) {
        return orders.find((o) => o.id === id) || null
      },
    }),
    [events, orders],
  )

  return (
    <AdminStoreContext.Provider value={value}>
      {children}
    </AdminStoreContext.Provider>
  )
}

export function useAdminStore() {
  const ctx = useContext(AdminStoreContext)
  if (!ctx) throw new Error('useAdminStore must be used within AdminStoreProvider')
  return ctx
}

export { ORDER_STATUS }
