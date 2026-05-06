import { useEffect, useState } from 'react'
import Modal from '../Modal.jsx'
import Input from '../Input.jsx'
import Button from '../Button.jsx'
import { defaultImageForCategory } from '../../lib/adminStore.jsx'

const CATEGORY_OPTIONS = [
  { value: 'sports', label: 'Sports' },
  { value: 'concerts', label: 'Concerts' },
  { value: 'arts', label: 'Arts & Theater' },
  { value: 'family', label: 'Family' },
]

const EMPTY = {
  title: '',
  category: 'sports',
  date: '',
  city: '',
  venue: '',
  price: '',
  image: '',
}

export default function EventForm({ open, mode, initial, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...EMPTY, ...initial } : EMPTY)
      setErrors({})
    }
  }, [open, initial])

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleCategoryChange(value) {
    setForm((prev) => ({
      ...prev,
      category: value,
      image:
        prev.image && !prev.image.includes('loremflickr.com')
          ? prev.image
          : defaultImageForCategory(value),
    }))
  }

  function handleUsePreset() {
    update('image', defaultImageForCategory(form.category))
  }

  function validate() {
    const next = {}
    if (!form.title.trim()) next.title = 'Title is required.'
    if (!form.category) next.category = 'Pick a category.'
    if (!form.date.trim()) next.date = 'Date is required.'
    if (!form.city.trim()) next.city = 'City is required.'
    if (!form.price.trim()) next.price = 'Price is required.'
    if (!form.image.trim()) next.image = 'Image URL is required.'
    return next
  }

  function handleSubmit(e) {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSubmit({
      ...form,
      title: form.title.trim(),
      city: form.city.trim(),
      venue: form.venue.trim(),
      price: form.price.trim().startsWith('$') ? form.price.trim() : `$${form.price.trim()}`,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit Event' : 'Create Event'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button onClick={handleSubmit} type="button">
            {mode === 'edit' ? 'Save changes' : 'Create event'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Event Title"
          placeholder="e.g. Lakers vs Warriors"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          error={errors.title}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Category</label>
          <select
            value={form.category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {errors.category && (
            <span className="text-xs text-red-600">{errors.category}</span>
          )}
          <p className="text-xs text-gray-400">
            Image preset auto-updates so visuals stay relevant to the category.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Date"
            placeholder="Sat, Jul 12 · 7:30 PM"
            value={form.date}
            onChange={(e) => update('date', e.target.value)}
            error={errors.date}
          />
          <Input
            label="Price"
            placeholder="$120"
            value={form.price}
            onChange={(e) => update('price', e.target.value)}
            error={errors.price}
          />
          <Input
            label="City"
            placeholder="Los Angeles"
            value={form.city}
            onChange={(e) => update('city', e.target.value)}
            error={errors.city}
          />
          <Input
            label="Venue (optional)"
            placeholder="SoFi Stadium"
            value={form.venue}
            onChange={(e) => update('venue', e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Image URL</label>
            <button
              type="button"
              onClick={handleUsePreset}
              className="text-xs font-medium text-brand hover:text-brand-dark"
            >
              Use category preset
            </button>
          </div>
          <input
            type="text"
            placeholder="https://..."
            value={form.image}
            onChange={(e) => update('image', e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand/30 ${
              errors.image
                ? 'border-red-400 focus:border-red-500'
                : 'border-gray-300 focus:border-brand'
            }`}
          />
          {errors.image && (
            <span className="text-xs text-red-600">{errors.image}</span>
          )}
          {form.image && (
            <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
              <img
                src={form.image}
                alt="Event preview"
                className="h-32 w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}
