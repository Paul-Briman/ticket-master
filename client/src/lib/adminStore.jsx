import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { EVENTS } from '../data/events.js'
import { categoryImg, CATEGORY_TAGS } from './image.js'
import { toSlug } from './slug.js'

const EVENTS_KEY = 'tm_admin_events'

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

export function defaultImageForCategory(category) {
  const tags = CATEGORY_TAGS[category] || 'event'
  const lock = Math.floor(Math.random() * 900) + 100
  return categoryImg(tags, { w: 600, h: 450, lock })
}

export function AdminStoreProvider({ children }) {
  const [events, setEvents] = useState(() => readEvents())

  useEffect(() => {
    writeEvents(events)
  }, [events])

  const value = useMemo(
    () => ({
      events,
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
    }),
    [events],
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

export const ORDER_STATUS = {
  PENDING: 'Pending Payment',
  PAID: 'Paid',
  REJECTED: 'Rejected',
}
