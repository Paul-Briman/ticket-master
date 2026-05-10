import { useEffect, useState } from 'react'
import Modal from '../Modal.jsx'
import Input from '../Input.jsx'
import Button from '../Button.jsx'

// Mirrors the platform's category set and the SUPPORTED_LEAGUES list
// in the backend sports router. Keep these arrays aligned with
// client/src/data/leagues.js + lib/routes/sports.js.
const CATEGORIES = [
  { key: 'sports', label: 'Sports' },
  { key: 'concerts', label: 'Concerts' },
  { key: 'arts', label: 'Arts & Theater' },
  { key: 'family', label: 'Family' },
]

const SPORTS_LEAGUES = [
  { key: 'world-cup', label: 'World Cup' },
  { key: 'ucl', label: 'UEFA Champions League' },
  { key: 'nba', label: 'NBA' },
  { key: 'nfl', label: 'NFL' },
  { key: 'mlb', label: 'MLB' },
  { key: 'f1', label: 'Formula 1' },
  { key: 'ufc', label: 'UFC / MMA' },
  { key: 'boxing', label: 'Boxing' },
  { key: 'tennis', label: 'Tennis' },
]

// Free-form genre suggestions per non-sports category. The backend
// stores `subcategory` as a free string so admins aren't locked in;
// the dropdown is just a convenience.
const SUBCATEGORY_PRESETS = {
  concerts: ['Afrobeats', 'Hip Hop', 'Pop', 'Rock', 'Gospel', 'EDM', 'Country', 'Jazz', 'Latin'],
  arts: ['Theatre', 'Comedy', 'Opera', 'Ballet', 'Musical', 'Cabaret'],
  family: ['Kids', 'Holiday', 'Circus', 'Ice Show', 'Magic'],
  sports: [],
}

const BADGE_TYPES = [
  { key: '', label: '— No badge —' },
  { key: 'hot', label: 'Selling Fast' },
  { key: 'limited', label: 'Limited' },
  { key: 'new', label: 'New' },
]

const EMPTY = {
  title: '',
  description: '',
  category: 'concerts',
  subcategory: '',
  league: '',
  sport: '',
  venue: '',
  city: '',
  country: '',
  date: '',
  utcDate: '',
  image: '',
  thumbnail: '',
  organizer: '',
  externalUrl: '',
  badge: '',
  badgeType: '',
  featured: false,
  soldOut: false,
  pricing: { standard: '', premium: '', vip: '' },
}

export default function CreateEventForm({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm(EMPTY)
      setError('')
    }
  }, [open])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function updatePricing(tier, value) {
    setForm((f) => ({ ...f, pricing: { ...f.pricing, [tier]: value } }))
  }

  function setCategory(category) {
    setForm((f) => ({
      ...f,
      category,
      // Clear sports-only fields when leaving sports
      league: category === 'sports' ? f.league : '',
      sport: category === 'sports' ? f.sport : '',
      // Clear subcategory when changing category — presets differ
      subcategory: '',
    }))
  }

  async function handleSubmit() {
    setError('')

    if (!form.title.trim()) {
      setError('Title is required.')
      return
    }
    if (!form.date.trim() && !form.utcDate.trim()) {
      setError('Date / time is required.')
      return
    }

    const standard = Number(form.pricing.standard)
    const premium = Number(form.pricing.premium)
    const vip = Number(form.pricing.vip)
    if (
      !Number.isFinite(standard) || standard < 0 ||
      !Number.isFinite(premium) || premium < 0 ||
      !Number.isFinite(vip) || vip < 0
    ) {
      setError('All three pricing tiers must be non-negative numbers.')
      return
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      category: form.category,
      subcategory: form.subcategory.trim() || undefined,
      league: form.category === 'sports' ? form.league.trim() || undefined : undefined,
      sport: form.category === 'sports' ? form.sport.trim() || undefined : undefined,
      venue: form.venue.trim() || undefined,
      city: form.city.trim() || undefined,
      country: form.country.trim() || undefined,
      date: form.date.trim() || undefined,
      utcDate: form.utcDate.trim() || undefined,
      image: form.image.trim() || undefined,
      thumbnail: form.thumbnail.trim() || undefined,
      organizer: form.organizer.trim() || undefined,
      externalUrl: form.externalUrl.trim() || undefined,
      badge: form.badge.trim() || undefined,
      badgeType: form.badgeType || undefined,
      featured: !!form.featured,
      soldOut: !!form.soldOut,
      pricing: { standard, premium, vip },
    }

    setSubmitting(true)
    try {
      const result = await onCreated(payload)
      if (result?.event) {
        // Modal owner closes us when create succeeds.
      }
    } catch (err) {
      setError(err.message || 'Failed to create event')
    } finally {
      setSubmitting(false)
    }
  }

  const subcategoryPresets = SUBCATEGORY_PRESETS[form.category] || []

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create event"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create event'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-blue-100 bg-blue-50/40 px-3 py-2 text-xs text-gray-700">
          <p>
            New events go live immediately on the public site under the
            category you pick. Pricing tiers seed the seat-by-seat
            availability the same way live events do — admins can edit
            or delete this event from the events table afterwards.
          </p>
        </div>

        <Input
          label="Title *"
          placeholder="e.g. Burna Boy — Love, Damini Tour"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
        />

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Description
          </span>
          <textarea
            rows={3}
            placeholder="Short blurb shown on the detail page."
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Category *
            </span>
            <select
              value={form.category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </label>

          {form.category === 'sports' ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                League
              </span>
              <select
                value={form.league}
                onChange={(e) => update('league', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="">— Choose league —</option>
                {SPORTS_LEAGUES.map((l) => (
                  <option key={l.key} value={l.key}>{l.label}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Subcategory / genre
              </span>
              <input
                type="text"
                list={`subcat-${form.category}`}
                placeholder="e.g. Afrobeats"
                value={form.subcategory}
                onChange={(e) => update('subcategory', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
              {subcategoryPresets.length > 0 && (
                <datalist id={`subcat-${form.category}`}>
                  {subcategoryPresets.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              )}
            </label>
          )}
        </div>

        {form.category === 'sports' && (
          <Input
            label="Sport (display label)"
            placeholder="e.g. Soccer, Basketball"
            value={form.sport}
            onChange={(e) => update('sport', e.target.value)}
          />
        )}

        <Input
          label="Date / time (display string) *"
          placeholder="e.g. Sat, Jul 12 · 7:30 PM"
          value={form.date}
          onChange={(e) => update('date', e.target.value)}
        />
        <Input
          label="UTC date (ISO 8601, optional — drives countdown)"
          placeholder="2026-07-12T19:30:00Z"
          value={form.utcDate}
          onChange={(e) => update('utcDate', e.target.value)}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Venue"
            placeholder="e.g. SoFi Stadium"
            value={form.venue}
            onChange={(e) => update('venue', e.target.value)}
          />
          <Input
            label="City"
            placeholder="e.g. Los Angeles"
            value={form.city}
            onChange={(e) => update('city', e.target.value)}
          />
          <Input
            label="Country"
            placeholder="e.g. United States"
            value={form.country}
            onChange={(e) => update('country', e.target.value)}
          />
          <Input
            label="Organizer"
            placeholder="e.g. Live Nation"
            value={form.organizer}
            onChange={(e) => update('organizer', e.target.value)}
          />
        </div>

        <Input
          label="Banner / hero image URL"
          placeholder="https://..."
          value={form.image}
          onChange={(e) => update('image', e.target.value)}
        />
        {form.image && (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <img
              src={form.image}
              alt=""
              className="h-32 w-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          </div>
        )}
        <Input
          label="Card thumbnail URL (optional — defaults to banner)"
          placeholder="https://..."
          value={form.thumbnail}
          onChange={(e) => update('thumbnail', e.target.value)}
        />

        <div>
          <p className="text-sm font-semibold text-gray-700">Pricing tiers *</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Drives Standard / Premium / VIP base prices. Per-row seat
            pricing is auto-generated from these and respects the
            VIP &gt; Premium &gt; Standard hierarchy.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Input
              label="Standard"
              type="number"
              min="0"
              value={form.pricing.standard}
              onChange={(e) => updatePricing('standard', e.target.value)}
            />
            <Input
              label="Premium"
              type="number"
              min="0"
              value={form.pricing.premium}
              onChange={(e) => updatePricing('premium', e.target.value)}
            />
            <Input
              label="VIP"
              type="number"
              min="0"
              value={form.pricing.vip}
              onChange={(e) => updatePricing('vip', e.target.value)}
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-700">Status</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Badge text
              </span>
              <input
                type="text"
                placeholder="e.g. Selling Fast"
                value={form.badge}
                onChange={(e) => update('badge', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Badge type (color)
              </span>
              <select
                value={form.badgeType}
                onChange={(e) => update('badgeType', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                {BADGE_TYPES.map((b) => (
                  <option key={b.key} value={b.key}>{b.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => update('featured', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
              />
              Featured (boosted on public lists)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.soldOut}
                onChange={(e) => update('soldOut', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
              />
              Sold out
            </label>
          </div>
        </div>

        <Input
          label="External ticket link (optional)"
          placeholder="https://..."
          value={form.externalUrl}
          onChange={(e) => update('externalUrl', e.target.value)}
        />

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </Modal>
  )
}
