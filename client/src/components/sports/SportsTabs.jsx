import { NavLink } from 'react-router-dom'
import { SPORTS_LEAGUES } from '../../data/leagues.js'

export default function SportsTabs({ active }) {
  const tabClass = (isActive) =>
    `flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-150 ${
      isActive
        ? 'border-brand bg-brand text-white shadow-sm'
        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
    }`

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex gap-2 overflow-x-auto py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <NavLink
            to="/sports"
            end
            className={({ isActive }) =>
              tabClass(active === 'all' || isActive)
            }
          >
            <span aria-hidden>🏟️</span>
            <span>All Sports</span>
          </NavLink>
          {SPORTS_LEAGUES.map((l) => (
            <NavLink
              key={l.key}
              to={`/sports/${l.key}`}
              className={() => tabClass(active === l.key)}
            >
              <span aria-hidden>{l.icon}</span>
              <span className="whitespace-nowrap">{l.short}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}
