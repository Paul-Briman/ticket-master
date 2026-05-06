import { Link } from 'react-router-dom'
import StatCard from '../../components/admin/StatCard.jsx'
import { useAdminStore } from '../../lib/adminStore.jsx'
import { formatPrice } from '../../lib/price.js'

function readUserCount() {
  try {
    const raw = JSON.parse(localStorage.getItem('tm_users') || '[]')
    return Array.isArray(raw) ? raw.length : 0
  } catch {
    return 0
  }
}

export default function Overview() {
  const { events, orders } = useAdminStore()
  const userCount = readUserCount()

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
          Dashboard
        </h1>
        <p className="text-sm text-gray-500">
          Quick overview of your ticket marketplace.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Events"
          value={events.length}
          hint="Across all categories"
          icon="🎟️"
        />
        <StatCard
          label="Total Users"
          value={userCount}
          hint="Registered accounts"
          icon="👥"
        />
        <StatCard
          label="Total Orders"
          value={orders.length}
          hint="Recent transactions"
          icon="🧾"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">
              Recent Events
            </h2>
            <Link
              to="/admin/events"
              className="text-xs font-medium text-brand hover:text-brand-dark"
            >
              View all →
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-gray-100">
            {events.slice(0, 5).map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {e.title}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {e.date} · {e.city}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-brand">
                  {e.price}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">
              Recent Orders
            </h2>
            <Link
              to="/admin/orders"
              className="text-xs font-medium text-brand hover:text-brand-dark"
            >
              View all →
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-gray-100">
            {orders.slice(0, 5).map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {o.eventTitle}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {o.user} · × {o.quantity}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-gray-900">
                  {typeof o.total === 'number' ? formatPrice(o.total) : o.total}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
