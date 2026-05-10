import { Link } from 'react-router-dom'
import { leagueImg } from '../../lib/image.js'

/**
 * Display a league hero card. The count comes from the parent (which
 * pulls it from useAllSportsEvents) — this is intentional so the
 * number on the card and the events on /sports/:league are derived
 * from the SAME fetched dataset. No separate /counts endpoint, no
 * second cache, no estimator.
 */
export default function LeagueCard({ league, lock = 1, count, loading = false }) {
  const image = leagueImg(league.key, { w: 600, h: 450, lock })

  // The backend caps each league at 30 events, so when we receive 30
  // we know there could be more upstream → show "30+".
  const CAP = 30

  let countLabel
  if (count === undefined || count === null) {
    countLabel = loading ? 'Loading...' : 'View league'
  } else if (count === 0) {
    countLabel = loading ? 'Loading...' : 'No upcoming events'
  } else if (count >= CAP) {
    countLabel = `${CAP}+ upcoming events`
  } else {
    countLabel = `${count} upcoming event${count === 1 ? '' : 's'}`
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
