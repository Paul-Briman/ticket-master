import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { EVENTS } from '../data/events.js'
import { categoryImg, CATEGORY_TAGS } from './image.js'
import { toSlug } from './slug.js'

const EVENTS_KEY = 'tm_admin_events'
const ORDERS_KEY = 'tm_admin_orders'

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

function buildSeedOrders(events) {
  const seedUsers = [
    { name: 'Jordan Lee', email: 'jordan@example.com' },
    { name: 'Maya Patel', email: 'maya@example.com' },
    { name: 'Carlos Rivera', email: 'carlos@example.com' },
    { name: 'Aisha Khan', email: 'aisha@example.com' },
    { name: 'Ethan Brooks', email: 'ethan@example.com' },
  ]
  return events.slice(0, 8).map((event, i) => {
    const user = seedUsers[i % seedUsers.length]
    const qty = (i % 3) + 1
    const base = Number(String(event.price).replace(/[^0-9.]/g, '')) || 50
    const total = base * qty * 1.12
    return {
      id: `o-${i + 1}`,
      eventId: event.id,
      eventTitle: event.title,
      user: user.name,
      email: user.email,
      quantity: qty,
      total: `$${total.toFixed(2)}`,
      status: i % 4 === 0 ? 'Pending' : 'Confirmed',
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

  const value = useMemo(
    () => ({
      events,
      orders,
      createEvent(data) {
        const id = data.id || `ev-${Date.now()}`
        const next = {
          ...data,
          id,
          citySlug: toSlug(data.city || ''),
        }
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
