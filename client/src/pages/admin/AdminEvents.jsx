import { useEffect, useMemo, useState } from 'react'
import EventOverrideForm from '../../components/admin/EventOverrideForm.jsx'
import { api } from '../../lib/api.js'
import { SkeletonRow } from '../../components/Skeleton.jsx'

const CATEGORY_LABELS = {
  sports: 'Sports',
  concerts: 'Concerts',
  arts: 'Arts & Theater',
  family: 'Family',
}

const CATEGORY_PILL = {
  sports: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  concerts: 'bg-purple-50 text-purple-700 border-purple-200',
  arts: 'bg-amber-50 text-amber-700 border-amber-200',
  family: 'bg-sky-50 text-sky-700 border-sky-200',
}

function formatPrice(n) {
  if (n == null) return '—'
  const num = Number(n)
  return Number.isFinite(num) ? `$${num}` : '—'
}

export default function AdminEvents() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await api.adminEvents()
      setEvents(Array.isArray(res?.events) ? res.events : [])
    } catch (err) {
      setError(err.message || 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    let list = events
    if (filter !== 'all') list = list.filter((e) => e.category === filter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (e) =>
          (e.title || '').toLowerCase().includes(q) ||
          (e.venue || '').toLowerCase().includes(q) ||
          (e.city || '').toLowerCase().includes(q),
      )
    }
    return list
  }, [events, filter, search])

  async function handleSave(id, patch) {
    await api.adminEventOverride(id, patch)
    await load()
    setEditing(null)
  }

  async function handleClearOverride(id) {
    if (!window.confirm('Revert this event to its live provider data?')) return
    await api.adminClearEventOverride(id)
    await load()
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            Events
          </h1>
          <p className="text-sm text-gray-500">
            {loading
              ? 'Loading...'
              : `${events.length} event${events.length === 1 ? '' : 's'} across live providers and curated catalog.`}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search title, venue, city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          <option value="all">All categories</option>
          <option value="sports">Sports</option>
          <option value="concerts">Concerts</option>
          <option value="arts">Arts & Theater</option>
          <option value="family">Family</option>
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} height="h-16" />
          ))}
        </div>
      ) : (
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Venue</th>
                  <th className="px-4 py-3">Pricing (S/P/V)</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((event) => {
                  const pricing = event.pricing || {}
                  return (
                    <tr key={event.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {event.image && (
                            <img
                              src={event.image}
                              alt=""
                              className="h-10 w-14 shrink-0 rounded object-cover"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-900">
                              {event.title}
                            </p>
                            <p className="truncate font-mono text-[10px] text-gray-400">
                              {event.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
                            CATEGORY_PILL[event.category] ||
                            'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          {CATEGORY_LABELS[event.category] || event.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {event.date || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="flex flex-col">
                          <span className="truncate">{event.venue || '—'}</span>
                          {event.city && (
                            <span className="text-xs text-gray-400">
                              {event.city}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {formatPrice(pricing.standard)} /{' '}
                        {formatPrice(pricing.premium)} /{' '}
                        {formatPrice(pricing.vip)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-gray-600">
                            {event.provider || '—'}
                          </span>
                          {event.adminEdited && (
                            <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-brand">
                              admin override
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditing(event)}
                            className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-brand hover:text-brand"
                          >
                            Edit
                          </button>
                          {event.adminEdited && (
                            <button
                              type="button"
                              onClick={() => handleClearOverride(event.id)}
                              className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-red-300 hover:text-red-600"
                            >
                              Revert
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm text-gray-500"
                    >
                      No events match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <EventOverrideForm
        open={!!editing}
        event={editing}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />
    </div>
  )
}
