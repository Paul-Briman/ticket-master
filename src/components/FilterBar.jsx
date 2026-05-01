import Button from './Button.jsx'

const US_CITY_OPTIONS = [
  'All U.S. Cities',
  'New York',
  'Los Angeles',
  'Chicago',
  'Houston',
  'Miami',
  'Atlanta',
  'Las Vegas',
  'San Francisco',
  'Dallas',
  'Seattle',
  'Boston',
  'Washington DC',
  'Orlando',
  'Phoenix',
]

const PRICE_RANGES = [
  'Any price',
  'Under $50',
  '$50 – $100',
  '$100 – $200',
  '$200 – $500',
  '$500+',
]

export default function FilterBar() {
  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6">
        <form
          onSubmit={(e) => e.preventDefault()}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <Field label="Date">
            <input
              type="date"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </Field>

          <Field label="Location">
            <select
              defaultValue="All U.S. Cities"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              {US_CITY_OPTIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>

          <Field label="Price">
            <select
              defaultValue="Any price"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              {PRICE_RANGES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>

          <div className="flex items-end">
            <Button type="submit" className="w-full md:w-auto">
              Apply Filters
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      {children}
    </label>
  )
}
