import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import UserMenu from './UserMenu.jsx'

const NAV_LINKS = [
  { to: '/sports', label: 'Sports' },
  { to: '/concerts', label: 'Concerts' },
  { to: '/arts', label: 'Arts & Theater' },
  { to: '/family', label: 'Family' },
  { to: '/cities', label: 'Cities' },
]

export default function Navbar() {
  const { user } = useAuth()

  const linkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors ${
      isActive
        ? 'text-brand'
        : 'text-gray-700 hover:text-brand'
    }`

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 md:gap-6 md:px-6 md:py-4">
        <Link
          to="/"
          className="shrink-0 text-lg font-bold text-brand md:text-xl"
        >
          TicketMaster
        </Link>

        <div className="hidden flex-1 justify-center md:flex">
          <div className="relative w-full max-w-xl">
            <input
              type="text"
              placeholder="Search events, artists, teams, venues..."
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>

        <div className="ml-auto">
          {user ? (
            <UserMenu />
          ) : (
            <NavLink
              to="/login"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
            >
              Login
            </NavLink>
          )}
        </div>
      </div>

      <nav className="border-t border-gray-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-2.5 md:px-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass} end>
              {({ isActive }) => (
                <span
                  className={`whitespace-nowrap border-b-2 pb-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-brand text-brand'
                      : 'border-transparent text-gray-700 hover:text-brand'
                  }`}
                >
                  {link.label}
                </span>
              )}
            </NavLink>
          ))}

          {user?.role === 'admin' && (
            <NavLink to="/admin" className={linkClass}>
              {({ isActive }) => (
                <span
                  className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-brand text-brand'
                      : 'border-transparent text-gray-700 hover:text-brand'
                  }`}
                >
                  <span aria-hidden>🛡️</span>
                  Admin
                </span>
              )}
            </NavLink>
          )}
        </div>
      </nav>

      <div className="border-t border-gray-100 px-4 py-2 md:hidden">
        <input
          type="text"
          placeholder="Search events..."
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      </div>
    </header>
  )
}
