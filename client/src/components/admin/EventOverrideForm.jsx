import { useEffect, useState } from 'react'
import Modal from '../Modal.jsx'
import Input from '../Input.jsx'
import Button from '../Button.jsx'

const FIELDS = [
  'title',
  'image',
  'venue',
  'city',
  'country',
  'date',
  'badge',
  'badgeType',
]

const BADGE_TYPES = [
  { key: '', label: '— No badge —' },
  { key: 'hot', label: 'Selling Fast (red)' },
  { key: 'limited', label: 'Limited (amber)' },
  { key: 'new', label: 'New (blue)' },
]

// Must match backend homepage section keys AND the sections rendered
// on Home.jsx. Keep in lockstep with lib/routes/homepageSections.js
// CANONICAL and client/src/lib/useHomepageSections.js SECTION_META.
const HOMEPAGE_SECTIONS = [
  { key: '', label: '— Pick a section —' },
  { key: 'world-cup-knockout', label: 'Knockout World Cup Matches' },
  { key: 'ucl', label: 'Champions League' },
  { key: 'nba', label: 'NBA Matchups' },
  { key: 'featured-sports', label: 'Featured Sports' },
  { key: 'concerts', label: 'Trending Concerts' },
  { key: 'arts', label: 'Arts & Theater' },
  { key: 'family', label: 'Family Events' },
]

export default function EventOverrideForm({ open, event, onClose, onSave }) {
  const [form, setForm] = useState({})
  const [pricing, setPricing] = useState({ standard: '', premium: '', vip: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !event) return
    setForm({
      title: event.title || '',
      image: event.image || '',
      venue: event.venue || '',
      city: event.city || '',
      country: event.country || '',
      date: event.date || '',
      badge: event.badge || '',
      badgeType: event.badgeType || '',
      // Homepage editorial fields — preload from the merged event so
      // opening the form shows the current state.
      featured: event.featured === true,
      featuredSection: event.featuredSection || '',
      featuredOrder:
        event.featuredOrder === null || event.featuredOrder === undefined
          ? ''
          : String(event.featuredOrder),
    })
    const p = event.pricing || {}
    setPricing({
      standard: p.standard ?? '',
      premium: p.premium ?? '',
      vip: p.vip ?? '',
    })
    setError('')
  }, [open, event])

  if (!event) return null

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function updatePricing(tier, value) {
    setPricing((p) => ({ ...p, [tier]: value }))
  }

  async function handleSubmit() {
    setError('')

    // Build patch — only include fields that differ from the live event
    // and are non-empty. That way overrides stay minimal.
    const patch = {}
    for (const field of FIELDS) {
      const next = (form[field] ?? '').trim?.() || form[field]
      if (next && next !== event[field]) {
        patch[field] = next
      }
    }

    // Homepage editorial fields need explicit compares because they
    // include boolean/numeric types that FIELDS' string-trim loop
    // above can't handle correctly.
    const nextFeatured = !!form.featured
    if (nextFeatured !== (event.featured === true)) {
      patch.featured = nextFeatured
    }
    const currentSection = event.featuredSection || ''
    const nextSection = form.featuredSection || ''
    if (nextSection !== currentSection) {
      patch.featuredSection = nextSection || null
    }
    const currentOrderRaw = event.featuredOrder
    const nextOrderStr = String(form.featuredOrder ?? '').trim()
    if (nextOrderStr === '') {
      // Admin cleared the order — persist as null if it wasn't already.
      if (currentOrderRaw !== null && currentOrderRaw !== undefined) {
        patch.featuredOrder = null
      }
    } else {
      const n = Number(nextOrderStr)
      if (!Number.isFinite(n)) {
        setError('Featured Order must be a number.')
        return
      }
      if (n !== Number(currentOrderRaw)) {
        patch.featuredOrder = n
      }
    }

    const newPricing = {}
    for (const tier of ['standard', 'premium', 'vip']) {
      const raw = pricing[tier]
      if (raw === '' || raw == null) continue
      const num = Number(raw)
      if (!Number.isFinite(num) || num < 0) {
        setError(`Pricing for ${tier} must be a non-negative number.`)
        return
      }
      if ((event.pricing || {})[tier] !== num) {
        newPricing[tier] = num
      }
    }
    if (Object.keys(newPricing).length > 0) patch.pricing = newPricing

    if (Object.keys(patch).length === 0) {
      setError('Nothing changed. Edit a field to save an override.')
      return
    }

    setSubmitting(true)
    try {
      await onSave(event.id, patch)
    } catch (err) {
      setError(err.message || 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  // Surface a helpful banner when the API didn't supply some location
  // fields — admin should know they're filling in (not seeing a bug).
  const missingFields = []
  if (!form.venue) missingFields.push('venue')
  if (!form.city) missingFields.push('city')
  if (!form.country) missingFields.push('country')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit ${event.title}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button" disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} type="button" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save override'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-blue-100 bg-blue-50/40 px-3 py-2 text-xs text-gray-700">
          <p>
            <span className="font-semibold text-brand">{event.provider}</span>{' '}
            ·{' '}
            <span className="font-mono text-[10px] text-gray-500">
              {event.id}
            </span>
          </p>
          <p className="mt-1">
            Edits override the live data on the public site. Click "Revert" on
            the events table to restore.
          </p>
        </div>

        {missingFields.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            The live API didn't supply{' '}
            <span className="font-semibold">
              {missingFields.join(', ')}
            </span>{' '}
            for this event. Fill these in to publish complete details — your
            entries will be saved and reused on every future load.
          </div>
        )}

        <Input
          label="Title"
          value={form.title || ''}
          onChange={(e) => update('title', e.target.value)}
        />

        <Input
          label="Image URL"
          placeholder="https://..."
          value={form.image || ''}
          onChange={(e) => update('image', e.target.value)}
        />
        {form.image && (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <img
              src={form.image}
              alt=""
              className="h-32 w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Venue"
            placeholder="e.g. Wembley Stadium"
            value={form.venue || ''}
            onChange={(e) => update('venue', e.target.value)}
          />
          <Input
            label="Date (display string)"
            placeholder="Sat, Jul 12 · 7:30 PM"
            value={form.date || ''}
            onChange={(e) => update('date', e.target.value)}
          />
          <Input
            label="City"
            placeholder="e.g. London"
            value={form.city || ''}
            onChange={(e) => update('city', e.target.value)}
          />
          <Input
            label="Country"
            placeholder="e.g. England"
            value={form.country || ''}
            onChange={(e) => update('country', e.target.value)}
          />
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-700">Pricing tiers</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Drives Standard / Premium / VIP base prices. Row-level prices on the
            event page are derived from these.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Input
              label="Standard"
              type="number"
              min="0"
              value={pricing.standard}
              onChange={(e) => updatePricing('standard', e.target.value)}
            />
            <Input
              label="Premium"
              type="number"
              min="0"
              value={pricing.premium}
              onChange={(e) => updatePricing('premium', e.target.value)}
            />
            <Input
              label="VIP"
              type="number"
              min="0"
              value={pricing.vip}
              onChange={(e) => updatePricing('vip', e.target.value)}
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-700">Badge</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Small pill shown in the top-left of the event card. Leave both
            empty to hide it.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Badge text
              </span>
              <input
                type="text"
                placeholder="e.g. Selling Fast"
                value={form.badge || ''}
                onChange={(e) => update('badge', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Badge type (color)
              </span>
              <select
                value={form.badgeType || ''}
                onChange={(e) => update('badgeType', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                {BADGE_TYPES.map((b) => (
                  <option key={b.key} value={b.key}>{b.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-700">Homepage</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Pin this event to the top of a homepage lane. Featured Order
            controls the display order (lower first). Leaving order blank
            still features the event, but it goes after ordered items.
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={!!form.featured}
              onChange={(e) => update('featured', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
            />
            Feature on Homepage
          </label>
          {form.featured && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Homepage Section
                </span>
                <select
                  value={form.featuredSection || ''}
                  onChange={(e) => update('featuredSection', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                >
                  {HOMEPAGE_SECTIONS.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Featured Order (optional)
                </span>
                <input
                  type="number"
                  placeholder="1"
                  value={form.featuredOrder ?? ''}
                  onChange={(e) => update('featuredOrder', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </label>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </Modal>
  )
}
