import { Link } from 'react-router-dom'
import { leagueImg } from '../../lib/image.js'
import { useLeagueCounts } from '../../lib/useLeagueCounts.js'

export default function LeagueCard({ league, lock = 1 }) {
  const { counts, loading } = useLeagueCounts()
  const eventCount = counts[league.key]
  const image = leagueImg(league.key, { w: 600, h: 450, lock })

  let countLabel
  if (loading && eventCount === undefined) {
    countLabel = 'Loading...'
  } else if (eventCount === undefined || eventCount === null) {
    countLabel = 'View league'
  } else if (eventCount === 0) {
    countLabel = 'No upcoming events'
  } else {
    countLabel = `${eventCount} upcoming event${eventCount === 1 ? '' : 's'}`
  }

  return (
    <Link
      to={`/sports/${league.key}`}
      className="group relative block aspect-[4/3] overflow-hidden rounded-lg border border-gray-200 bg-white transition-all duration-200 hover:-translate-y-1 hover:border-gray-300 hover:shadow-md"
    >
      <img
        src={image}
        alt={league.name}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div
        className={`absolute inset-0 bg-gradient-to-br ${league.accent} opacity-70 mix-blend-multiply`}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
        <div className="flex items-center gap-2">
          <span className="text-2xl drop-shadow" aria-hidden>
            {league.icon}
          </span>
          <h3 className="truncate text-base font-bold drop-shadow md:text-lg">
            {league.name}
          </h3>
        </div>
        <p className="mt-1 text-xs text-white/80 md:text-sm">{countLabel}</p>
      </div>
    </Link>
  )
}
