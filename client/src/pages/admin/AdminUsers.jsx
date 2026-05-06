import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api.js'

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export default function AdminUsers() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api
      .adminOrders()
      .then((res) => {
        if (!cancelled) setOrders(res.orders || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load users.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const users = useMemo(() => {
    const map = new Map()
    for (const o of orders) {
      const key = (o.email || '').toLowerCase()
      if (!key) continue
      const existing = map.get(key)
      if (existing) {
        existing.orderCount += 1
      } else {
        map.set(key, { name: o.user || key, email: o.email, orderCount: 1 })
      }
    }
    return [...map.values()].sort((a, b) => b.orderCount - a.orderCount)
  }, [orders])

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Users</h1>
        <p className="text-sm text-gray-500">
          {loading
            ? 'Loading users...'
            : `${users.length} customer${users.length === 1 ? '' : 's'} have placed orders.`}
        </p>
      </header>

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
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u, i) => (
                <tr key={u.email + i} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-brand">
                        {initials(u.name) || 'U'}
                      </span>
                      <span className="font-medium text-gray-900">
                        {u.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-gray-700">× {u.orderCount}</td>
                </tr>
              ))}
              {!loading && users.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-12 text-center text-sm text-gray-500"
                  >
                    No customers yet — they’ll appear here after the first
                    order is placed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
