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

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orderCounts, setOrderCounts] = useState({})
  const [search, setSearch] = useState('')
  const [deletingEmail, setDeletingEmail] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [usersRes, ordersRes] = await Promise.all([
        api.adminUsers(),
        api.adminOrders().catch(() => ({ orders: [] })),
      ])
      const list = Array.isArray(usersRes?.users) ? usersRes.users : []
      // Tally orders per email so the admin can still see customer
      // engagement at a glance — same number AdminUsers used to derive.
      const counts = {}
      for (const o of ordersRes?.orders || []) {
        const k = (o.email || '').toLowerCase()
        if (k) counts[k] = (counts[k] || 0) + 1
      }
      setOrderCounts(counts)
      setUsers(list)
    } catch (err) {
      setError(err.message || 'Could not load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    if (!search) return users
    const q = search.toLowerCase()
    return users.filter(
      (u) =>
        (u.email || '').toLowerCase().includes(q) ||
        (u.name || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q),
    )
  }, [users, search])

  async function handleDelete(user) {
    if (!user.deletable) return
    const ok = window.confirm(
      `Delete account for ${user.email}?\n\nThis permanently removes the user and is not reversible.`,
    )
    if (!ok) return
    setDeleteError('')
    setDeletingEmail(user.email)
    try {
      await api.adminDeleteUser(user.email)
      await load()
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete user.')
    } finally {
      setDeletingEmail(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Users</h1>
        <p className="text-sm text-gray-500">
          {loading
            ? 'Loading users...'
            : `${users.length} registered user${users.length === 1 ? '' : 's'}.`}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search name, email, role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {deleteError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {deleteError}
        </div>
      )}

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Verified</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u) => {
                const orders = orderCounts[u.email] || 0
                const isDeleting = deletingEmail === u.email
                return (
                  <tr key={u.email} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-brand">
                          {initials(u.name || u.email) || 'U'}
                        </span>
                        <span className="font-medium text-gray-900">
                          {u.name || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
                          u.role === 'admin'
                            ? 'border-blue-200 bg-blue-50 text-brand'
                            : 'border-gray-200 bg-gray-50 text-gray-700'
                        }`}
                      >
                        {u.role || 'user'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {u.verified ? (
                        <span className="text-emerald-700">✓ Verified</span>
                      ) : (
                        <span className="text-gray-400">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">× {orders}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(u)}
                        disabled={!u.deletable || isDeleting}
                        title={
                          u.isPrimaryAdmin
                            ? 'The primary admin account cannot be deleted.'
                            : u.isSelf
                              ? "You can't delete your own account."
                              : undefined
                        }
                        className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:text-gray-700"
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-gray-500"
                  >
                    No users match your search.
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
