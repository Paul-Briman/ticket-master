import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import UserMenu from './UserMenu.jsx'

const NAV_LINKS = [
  { to: '/sports', label: 'Sports' },
  { to: '/concerts', label: 'Concerts' },
  { to: '/arts', label: 'Arts & Theater' },
  { to: '/family', label: 'Family' },
  { to: '/cities', label: 'Cities' },
]

const SCROLL_THRESHOLD = 60

export default function Navbar() {
  const { user } = useAuth()
  const location = useLocation()
  const isHomepage = location.pathname === '/'

  const [scrolled, setScrolled] = useState(
    typeof window !== 'undefined' ? window.scrollY > SCROLL_THRESHOLD : false,
  )

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > SCROLL_THRESHOLD)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [location.pathname])

  const transparent = isHomepage && !scrolled

  const headerCls = `sticky top-0 z-40 transition-colors duration-300 ${
    transparent
      ? 'bg-brand text-white border-b border-white/10'
      : 'bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 text-gray-900 border-b border-gray-200'
  }`

  const subRowBorder = transparent ? 'border-white/15' : 'border-gray-100'

  const navLinkRender = ({ isActive }) =>
    `whitespace-nowrap border-b-2 pb-1.5 text-sm font-medium transition-colors ${
      isActive
        ? transparent
          ? 'border-white text-white'
          : 'border-brand text-brand'
        : transparent
          ? 'border-transparent text-white/85 hover:text-white'
          : 'border-transparent text-gray-700 hover:text-brand'
    }`

  const searchCls = transparent
    ? 'w-full rounded-lg border border-white/30 bg-white/15 px-4 py-2 text-sm text-white placeholder-white/70 transition-colors focus:border-white focus:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/40'
    : 'w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30'

  const mobileSearchCls = transparent
    ? 'w-full rounded-lg border border-white/30 bg-white/15 px-3 py-2 text-sm text-white placeholder-white/70 focus:border-white focus:outline-none focus:ring-2 focus:ring-white/40'
    : 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30'

  return (
    <header className={headerCls}>
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 md:gap-6 md:px-6 md:py-4">
        <Link to="/" className="shrink-0">
          <span
            className={`inline-block rounded-md px-2.5 py-1 text-lg font-bold italic text-white transition-colors md:text-xl ${
              transparent ? 'bg-white/15' : 'bg-brand'
            }`}
          >
            ticketmaster<sup className="text-[0.55em]">®</sup>
          </span>
        </Link>

        <div className="hidden flex-1 justify-center md:flex">
          <div className="relative w-full max-w-xl">
            <input
              type="text"
              placeholder="Search events, artists, teams, venues..."
              className={searchCls}
            />
          </div>
        </div>

        <div className="ml-auto">
          {user ? (
            <UserMenu transparent={transparent} />
          ) : transparent ? (
            <NavLink
              to="/login"
              className="rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              Login
            </NavLink>
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

      <nav className={`border-t ${subRowBorder} transition-colors duration-300`}>
        <div className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-2.5 md:px-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end className={navLinkRender}>
              {link.label}
            </NavLink>
          ))}

          {user?.role === 'admin' && (
            <NavLink to="/admin">
              {({ isActive }) => (
                <span
                  className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? transparent
                        ? 'border-white text-white'
                        : 'border-brand text-brand'
                      : transparent
                        ? 'border-transparent text-white/85 hover:text-white'
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

      <div
        className={`border-t ${subRowBorder} px-4 py-2 transition-colors duration-300 md:hidden`}
      >
        <input
          type="text"
          placeholder="Search events..."
          className={mobileSearchCls}
        />
      </div>
    </header>
  )
}
