import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/Button.jsx'
import { SkeletonRow } from '../../components/Skeleton.jsx'
import { api } from '../../lib/api.js'
import {
  SECTION_META,
  invalidateHomepageSectionsCache,
} from '../../lib/useHomepageSections.js'

// Bounds mirror the backend validator so the number input UX matches
// what will actually be persisted.
const LIMIT_MIN = 1
const LIMIT_MAX = 20
const LIMIT_DEFAULT = 8

export default function AdminHomepageSections() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await api.adminHomepageSections()
        if (cancelled) return
        setRows(Array.isArray(res?.sections) ? res.sections : [])
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load sections')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  function updateRow(idx, patch) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    )
    setDirty(true)
  }

  function moveRow(idx, delta) {
    const target = idx + delta
    if (target < 0 || target >= rows.length) return
    setRows((prev) => {
      const next = prev.slice()
      const [item] = next.splice(idx, 1)
      next.splice(target, 0, item)
      return next.map((r, i) => ({ ...r, order: i }))
    })
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const payload = rows.map((r, i) => ({
        key: r.key,
        enabled: r.enabled !== false,
        limit: clampLimit(r.limit),
        order: i,
      }))
      const res = await api.adminSaveHomepageSections(payload)
      const saved = Array.isArray(res?.sections) ? res.sections : payload
      setRows(saved)
      invalidateHomepageSectionsCache(saved)
      setSavedAt(new Date())
      setDirty(false)
    } catch (err) {
      setError(err.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const summary = useMemo(() => {
    const enabled = rows.filter((r) => r.enabled !== false).length
    return `${enabled} of ${rows.length} enabled`
  }, [rows])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            Homepage Sections
          </h1>
          <p className="text-sm text-gray-500">
            {loading ? 'Loading sections...' : summary}
            {' · '}Sections auto-hide on the homepage when they have zero
            upcoming events.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && !dirty && !error && (
            <span className="text-xs text-emerald-700">
              Saved · homepage will update within 30s
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || loading || !dirty}
          >
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonRow key={i} height="h-16" />
          ))}
        </div>
      ) : (
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 w-12">Order</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3 w-32">Display Limit</th>
                <th className="px-4 py-3 w-20">Enabled</th>
                <th className="px-4 py-3 w-24 text-right">Move</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, idx) => {
                const meta = SECTION_META[row.key] || {}
                return (
                  <tr key={row.key} className="hover:bg-gray-50/40">
                    <td className="px-4 py-3 text-xs font-mono text-gray-400">
                      #{idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {meta.title || row.key}
                      </div>
                      {meta.subtitle && (
                        <div className="text-xs text-gray-500 line-clamp-1">
                          {meta.subtitle}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={LIMIT_MIN}
                        max={LIMIT_MAX}
                        step={1}
                        value={row.limit ?? LIMIT_DEFAULT}
                        onChange={(e) =>
                          updateRow(idx, { limit: Number(e.target.value) })
                        }
                        className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                      />
                      <span className="ml-1 text-[10px] text-gray-400">
                        1-{LIMIT_MAX}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={row.enabled !== false}
                          onChange={(e) =>
                            updateRow(idx, { enabled: e.target.checked })
                          }
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span className="text-xs text-gray-700">
                          {row.enabled !== false ? 'On' : 'Off'}
                        </span>
                      </label>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => moveRow(idx, -1)}
                          disabled={idx === 0}
                          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 disabled:opacity-30 hover:border-brand hover:text-brand"
                          aria-label="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRow(idx, 1)}
                          disabled={idx === rows.length - 1}
                          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 disabled:opacity-30 hover:border-brand hover:text-brand"
                          aria-label="Move down"
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      <p className="text-xs text-gray-500">
        Notes: display limits are homepage-only — they do not affect
        search results, category pages, or the See All destination. Each
        section's See All button always goes to the full catalog for that
        category. Empty sections hide automatically; there's no separate
        "no events" empty state on the homepage lane.
      </p>
    </div>
  )
}

function clampLimit(n) {
  const v = Math.floor(Number(n))
  if (!Number.isFinite(v)) return LIMIT_DEFAULT
  return Math.max(LIMIT_MIN, Math.min(LIMIT_MAX, v))
}
