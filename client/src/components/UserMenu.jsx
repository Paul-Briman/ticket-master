import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { useFavorites } from '../lib/favorites.js'

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export default function UserMenu({ transparent = false }) {
  const { user, logout } = useAuth()
  const { favoriteCount } = useFavorites()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null

  function handleLogout() {
    logout()
    setOpen(false)
    navigate('/')
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors ${
          transparent
            ? 'border-white/40 bg-white/10 text-white hover:bg-white/20'
            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:text-brand'
        }`}
      >
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
            transparent
              ? 'bg-white text-brand'
              : 'bg-brand text-white'
          }`}
        >
          {initials(user.name) || 'U'}
        </span>
        <span className="hidden max-w-[140px] truncate sm:inline">
          {user.name}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 transition-transform ${
            transparent ? 'text-white/70' : 'text-gray-400'
          } ${open ? 'rotate-180' : ''}`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">{user.name}</p>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          </div>
          <Link
            to="/my-tickets"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-brand"
          >
            <span className="flex items-center gap-2">
              <span aria-hidden>🎟️</span>
              My Tickets
            </span>
          </Link>
          <Link
            to="/favorites"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-brand"
          >
            <span className="flex items-center gap-2">
              <span aria-hidden>❤️</span>
              Favorites
            </span>
            {favoriteCount > 0 && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-brand">
                {favoriteCount}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-red-600"
          >
            <span aria-hidden>↩</span>
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  )
}
