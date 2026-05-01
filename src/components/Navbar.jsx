import { Link, NavLink } from 'react-router-dom'

export default function Navbar() {
  const linkClass = ({ isActive }) =>
    `hidden sm:inline-block text-sm font-medium transition-colors ${
      isActive ? 'text-brand' : 'text-gray-700 hover:text-brand'
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

        <nav className="ml-auto flex items-center gap-4 md:gap-6">
          <NavLink to="/sports" className={linkClass}>
            Sports
          </NavLink>
          <NavLink to="/concerts" className={linkClass}>
            Concerts
          </NavLink>
          <NavLink
            to="/login"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            Login
          </NavLink>
        </nav>
      </div>

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
