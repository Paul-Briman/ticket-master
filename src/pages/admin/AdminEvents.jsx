import { useState } from 'react'
import Button from '../../components/Button.jsx'
import EventForm from '../../components/admin/EventForm.jsx'
import { useAdminStore, defaultImageForCategory } from '../../lib/adminStore.jsx'

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

export default function AdminEvents() {
  const { events, createEvent, updateEvent, deleteEvent } = useAdminStore()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('create')
  const [editing, setEditing] = useState(null)

  function openCreate() {
    setMode('create')
    setEditing({
      category: 'sports',
      image: defaultImageForCategory('sports'),
    })
    setOpen(true)
  }

  function openEdit(event) {
    setMode('edit')
    setEditing(event)
    setOpen(true)
  }

  function handleSubmit(data) {
    if (mode === 'edit' && editing?.id) {
      updateEvent(editing.id, data)
    } else {
      createEvent(data)
    }
    setOpen(false)
  }

  function handleDelete(event) {
    if (window.confirm(`Delete "${event.title}"? This cannot be undone.`)) {
      deleteEvent(event.id)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            Events
          </h1>
          <p className="text-sm text-gray-500">
            {events.length} event{events.length === 1 ? '' : 's'} total ·
            create, edit, or remove listings.
          </p>
        </div>
        <Button onClick={openCreate}>+ Create Event</Button>
      </header>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={event.image}
                        alt=""
                        className="h-10 w-14 shrink-0 rounded object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900">
                          {event.title}
                        </p>
                        {event.venue && (
                          <p className="truncate text-xs text-gray-500">
                            {event.venue}
                          </p>
                        )}
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
                  <td className="px-4 py-3 text-gray-600">{event.date}</td>
                  <td className="px-4 py-3 text-gray-600">{event.city}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    {event.price}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(event)}
                        className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-brand hover:text-brand"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(event)}
                        className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-red-300 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-sm text-gray-500"
                  >
                    No events yet. Click “Create Event” to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <EventForm
        open={open}
        mode={mode}
        initial={editing}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
