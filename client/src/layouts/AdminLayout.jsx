import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true, icon: '📊' },
  { to: '/admin/events', label: 'Events', icon: '🎟️' },
  { to: '/admin/homepage-sections', label: 'Homepage', icon: '🏠' },
  { to: '/admin/promotions', label: 'Promotions', icon: '🏷️' },
  { to: '/admin/users', label: 'Users', icon: '👥' },
  { to: '/admin/orders', label: 'Orders', icon: '🧾' },
]

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user } = useAuth()

  return (
    <div className="bg-gray-50">
        <div className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white">
                🛡️
              </span>
              <div>
                <p className="text-base font-bold text-gray-900">Admin Panel</p>
                <p className="text-xs text-gray-500">
                  Manage events, users, and orders
                </p>
              </div>
            </div>
            {user && (
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Signed in as
                </p>
                <p className="text-sm font-medium text-gray-800">
                  {user.email}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row md:px-6 md:py-8">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 md:hidden"
          >
            <span>Admin Menu</span>
            <span aria-hidden>{mobileOpen ? '▲' : '▼'}</span>
          </button>

          <aside
            className={`${mobileOpen ? 'block' : 'hidden'} md:block md:w-60 md:shrink-0`}
          >
            <nav className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-2">
              <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Admin
              </p>
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-brand'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-brand'
                    }`
                  }
                >
                  <span aria-hidden>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </aside>

          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
    </div>
  )
}
