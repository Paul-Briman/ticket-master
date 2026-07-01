import { leagueImg } from '../../lib/image.js'
import Image from '../Image.jsx'

export default function LeagueHero({ league }) {
  const image = leagueImg(league.key, { w: 1920, h: 700, lock: 50 })

  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <Image
          src={image}
          alt={league.name}
          className="h-full w-full object-cover"
          // LCP element on the league landing page → prioritize.
          priority
        />
        <div
          className={`absolute inset-0 bg-gradient-to-r ${league.accent} opacity-80 mix-blend-multiply`}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/20" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-20">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl backdrop-blur md:h-12 md:w-12 md:text-3xl"
            aria-hidden
          >
            {league.icon}
          </span>
          <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur">
            {league.short}
          </span>
        </div>

        <h1 className="mt-5 text-3xl font-bold leading-tight text-white drop-shadow-md md:text-5xl">
          {league.name}
        </h1>
        <p className="mt-3 max-w-2xl text-base text-gray-100 drop-shadow md:text-lg">
          {league.tagline}
        </p>
      </div>
    </section>
  )
}
