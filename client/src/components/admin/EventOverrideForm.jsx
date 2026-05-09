import { useEffect, useState } from 'react'
import Modal from '../Modal.jsx'
import Input from '../Input.jsx'
import Button from '../Button.jsx'

const FIELDS = ['title', 'image', 'venue', 'city', 'country', 'date']

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

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </Modal>
  )
}
