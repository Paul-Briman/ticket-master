import { useEffect, useMemo, useState } from 'react'
import Modal from '../../components/Modal.jsx'
import Button from '../../components/Button.jsx'
import Input from '../../components/Input.jsx'
import { SkeletonRow } from '../../components/Skeleton.jsx'
import { api } from '../../lib/api.js'

const STATUS_PILL = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  expired: 'bg-gray-100 text-gray-600 border-gray-200',
  disabled: 'bg-amber-50 text-amber-700 border-amber-200',
}

const SCOPES = [
  { value: 'all', label: 'All Events' },
  { value: 'category', label: 'Specific Category' },
  { value: 'league', label: 'Specific League' },
  { value: 'events', label: 'Specific Event(s)' },
]

const CATEGORIES = [
  { value: 'sports', label: 'Sports' },
  { value: 'concerts', label: 'Concerts' },
  { value: 'arts', label: 'Arts & Theater' },
  { value: 'family', label: 'Family' },
]

// Slugs match what the providers emit on `event.league` so the
// backend matcher just compares strings.
const LEAGUES = [
  { value: 'world-cup', label: 'World Cup' },
  { value: 'ucl', label: 'UEFA Champions League' },
  { value: 'nba', label: 'NBA' },
  { value: 'nfl', label: 'NFL' },
  { value: 'mlb', label: 'MLB' },
  { value: 'f1', label: 'F1' },
  { value: 'ufc', label: 'UFC' },
  { value: 'tennis', label: 'Tennis' },
  { value: 'boxing', label: 'Boxing' },
]

export default function AdminPromotions() {
  const [promotions, setPromotions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // promotion being edited, or 'new'
  const [busyId, setBusyId] = useState(null) // currently mutating row

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await api.adminPromotions()
      setPromotions(Array.isArray(res?.promotions) ? res.promotions : [])
    } catch (err) {
      setError(err.message || 'Could not load promotions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const stats = useMemo(() => {
    const out = { active: 0, scheduled: 0, expired: 0, disabled: 0 }
    for (const p of promotions) out[p.status] = (out[p.status] || 0) + 1
    return out
  }, [promotions])

  async function handleDelete(p) {
    if (!confirm(`Delete promotion "${p.name}"? This cannot be undone.`)) return
    setBusyId(p.id)
    try {
      await api.adminDeletePromotion(p.id)
      setPromotions((prev) => prev.filter((x) => x.id !== p.id))
    } catch (err) {
      alert(err.message || 'Could not delete')
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggle(p) {
    setBusyId(p.id)
    try {
      const res = await api.adminUpdatePromotion(p.id, { enabled: !p.enabled })
      setPromotions((prev) => prev.map((x) => (x.id === p.id ? res.promotion : x)))
    } catch (err) {
      alert(err.message || 'Could not update')
    } finally {
      setBusyId(null)
    }
  }

  async function handleClone(p) {
    setBusyId(p.id)
    try {
      const res = await api.adminClonePromotion(p.id)
      setPromotions((prev) => [res.promotion, ...prev])
    } catch (err) {
      alert(err.message || 'Could not duplicate')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            Promotions
          </h1>
          <p className="text-sm text-gray-500">
            {loading
              ? 'Loading promotions...'
              : `${promotions.length} total · ${stats.active} active · ${stats.scheduled} scheduled · ${stats.expired} expired · ${stats.disabled} disabled`}
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>+ New Promotion</Button>
      </header>

      {loading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonRow key={i} height="h-16" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Applies To</th>
                <th className="px-4 py-3">Window</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {promotions.map((p) => {
                const isBusy = busyId === p.id
                return (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.name}</div>
                      <div className="font-mono text-[10px] text-gray-400">{p.id}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {p.discountType === 'percentage'
                        ? `${p.discountValue}%`
                        : `$${p.discountValue}`}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {describeAppliesTo(p.appliesTo)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      <div>{formatShort(p.startsAt)}</div>
                      <div className="text-gray-400">→ {formatShort(p.endsAt)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
                          STATUS_PILL[p.status] || STATUS_PILL.expired
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditing(p)}
                          disabled={isBusy}
                          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:border-brand hover:text-brand disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggle(p)}
                          disabled={isBusy}
                          className="rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                        >
                          {p.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClone(p)}
                          disabled={isBusy}
                          className="rounded-md border border-blue-200 bg-white px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          disabled={isBusy}
                          className="rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!loading && promotions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">
                    No promotions yet. Create one to start applying discounts.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <PromotionFormModal
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={(saved, mode) => {
          setEditing(null)
          if (mode === 'create') {
            setPromotions((prev) => [saved, ...prev])
          } else {
            setPromotions((prev) =>
              prev.map((p) => (p.id === saved.id ? saved : p)),
            )
          }
        }}
      />
    </div>
  )
}

// ---------- Modal form ----------

function PromotionFormModal({ editing, onClose, onSaved }) {
  const open = !!editing
  const isNew = editing === 'new'

  // Local form state — initialized from the editing prop each time
  // the modal opens. For "new", we seed with sensible defaults.
  const [form, setForm] = useState(() => initialForm(editing))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm(initialForm(editing))
      setError('')
    }
  }, [editing, open])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        name: form.name,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        enabled: form.enabled,
        appliesTo: buildAppliesTo(form),
      }
      if (isNew) {
        const res = await api.adminCreatePromotion(payload)
        onSaved(res.promotion, 'create')
      } else {
        const res = await api.adminUpdatePromotion(editing.id, payload)
        onSaved(res.promotion, 'update')
      }
    } catch (err) {
      setError(err.message || 'Could not save')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? 'New Promotion' : 'Edit Promotion'}
      footer={
        <>
          <Button
            variant="secondary"
            type="button"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" form="promotion-form" disabled={submitting}>
            {submitting ? 'Saving...' : isNew ? 'Create' : 'Save'}
          </Button>
        </>
      }
    >
      {open && (
        <form
          id="promotion-form"
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          <Input
            label="Promotion name"
            placeholder="e.g. World Cup Knockout Sale"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Discount type
              </span>
              <select
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed amount ($)</option>
              </select>
            </label>
            <Input
              label={form.discountType === 'percentage' ? 'Percent off' : 'Dollars off'}
              type="number"
              min={1}
              max={form.discountType === 'percentage' ? 100 : 100000}
              value={form.discountValue}
              onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Starts at"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              required
            />
            <Input
              label="Ends at"
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              required
            />
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Applies to
            </span>
            <select
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value })}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {SCOPES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>

          {form.scope === 'category' && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Category
              </span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
          )}

          {form.scope === 'league' && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                League
              </span>
              <select
                value={form.league}
                onChange={(e) => setForm({ ...form, league: e.target.value })}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                {LEAGUES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </label>
          )}

          {form.scope === 'events' && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Event IDs (comma-separated)
              </span>
              <textarea
                rows={3}
                placeholder="e.g. adm-abc123, sportsdb-100456"
                value={form.eventIds}
                onChange={(e) => setForm({ ...form, eventIds: e.target.value })}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm"
              />
            </label>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            Enabled
          </label>

          <PreviewBlock form={form} />

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </form>
      )}
    </Modal>
  )
}

function PreviewBlock({ form }) {
  const value = Number(form.discountValue) || 0
  const sampleBase = 100
  const sample =
    form.discountType === 'percentage'
      ? Math.max(0, Math.round(sampleBase * (1 - value / 100)))
      : Math.max(0, sampleBase - value)
  const scopeText = describeAppliesTo(buildAppliesTo(form))
  return (
    <div className="rounded-md border border-blue-100 bg-blue-50/40 p-3 text-xs text-gray-700">
      <p className="font-semibold text-brand">Preview</p>
      <p className="mt-1">
        A $100 ticket would sell for{' '}
        <span className="font-bold text-brand">${sample}</span> while this
        promo is active.
      </p>
      <p className="mt-1 text-gray-500">Scope: {scopeText}</p>
    </div>
  )
}

// ---------- Helpers ----------

function initialForm(editing) {
  if (editing === 'new' || !editing) {
    // Default: today → +30 days, 10% off sitewide.
    const now = new Date()
    const end = new Date(now.getTime() + 30 * 86400000)
    return {
      name: '',
      discountType: 'percentage',
      discountValue: 10,
      startsAt: toLocalInput(now),
      endsAt: toLocalInput(end),
      enabled: true,
      scope: 'all',
      category: 'sports',
      league: 'world-cup',
      eventIds: '',
    }
  }
  return {
    name: editing.name || '',
    discountType: editing.discountType || 'percentage',
    discountValue: editing.discountValue ?? 10,
    startsAt: toLocalInput(new Date(editing.startsAt)),
    endsAt: toLocalInput(new Date(editing.endsAt)),
    enabled: editing.enabled !== false,
    scope: editing.appliesTo?.scope || 'all',
    category: editing.appliesTo?.category || 'sports',
    league: editing.appliesTo?.league || 'world-cup',
    eventIds: (editing.appliesTo?.eventIds || []).join(', '),
  }
}

function buildAppliesTo(form) {
  switch (form.scope) {
    case 'category':
      return { scope: 'category', category: form.category }
    case 'league':
      return { scope: 'league', league: form.league }
    case 'events':
      return {
        scope: 'events',
        eventIds: form.eventIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }
    default:
      return { scope: 'all' }
  }
}

function describeAppliesTo(appliesTo) {
  if (!appliesTo) return 'All events'
  switch (appliesTo.scope) {
    case 'all':
      return 'All events'
    case 'category':
      return `Category: ${appliesTo.category}`
    case 'league':
      return `League: ${appliesTo.league}`
    case 'events':
      return `${(appliesTo.eventIds || []).length} specific event(s)`
    default:
      return 'Unknown'
  }
}

function formatShort(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Convert a Date → "YYYY-MM-DDTHH:MM" string that <input type="datetime-local">
// accepts. Uses the LOCAL timezone (datetime-local has no TZ concept).
function toLocalInput(date) {
  const pad = (n) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const min = pad(date.getMinutes())
  return `${y}-${m}-${d}T${h}:${min}`
}
