export const SPORTS_LEAGUES = [
  {
    key: 'world-cup',
    name: 'FIFA World Cup',
    short: 'World Cup',
    icon: '⚽',
    tagline: 'The biggest stage in football.',
    accent: 'from-blue-700 via-blue-600 to-red-600',
    description:
      'Watch the best national teams in the world battle for the trophy.',
  },
  {
    key: 'nba',
    name: 'NBA',
    short: 'NBA',
    icon: '🏀',
    tagline: 'The premier basketball league on the planet.',
    accent: 'from-orange-600 via-amber-500 to-blue-700',
    description:
      'Every dunk, three-pointer, and buzzer-beater of the NBA season.',
  },
  {
    key: 'ucl',
    name: 'UEFA Champions League',
    short: 'UCL',
    icon: '🏆',
    tagline: 'Europe’s most prestigious club competition.',
    accent: 'from-blue-900 via-blue-700 to-indigo-600',
    description:
      'Continental glory, iconic anthems, and the world’s elite clubs.',
  },
  {
    key: 'nfl',
    name: 'NFL',
    short: 'NFL',
    icon: '🏈',
    tagline: 'America’s biggest game, every Sunday.',
    accent: 'from-red-700 via-rose-700 to-blue-900',
    description: 'Touchdowns, rivalries, and playoff thrillers from the NFL.',
  },
  {
    key: 'f1',
    name: 'Formula 1',
    short: 'F1',
    icon: '🏎️',
    tagline: 'The pinnacle of motorsport.',
    accent: 'from-red-600 via-rose-600 to-black',
    description: 'Race-day adrenaline at iconic circuits around the world.',
  },
  {
    key: 'ufc',
    name: 'UFC',
    short: 'UFC',
    icon: '🥊',
    tagline: 'The world’s biggest mixed martial arts league.',
    accent: 'from-red-700 via-rose-700 to-zinc-900',
    description:
      'Title fights and main events inside the octagon, live and unfiltered.',
  },
  {
    key: 'tennis',
    name: 'Tennis',
    short: 'Tennis',
    icon: '🎾',
    tagline: 'Grand slam moments and ATP rivalries.',
    accent: 'from-emerald-600 via-green-600 to-yellow-500',
    description:
      'Center-court drama from the world’s best tennis tournaments.',
  },
  {
    key: 'boxing',
    name: 'Boxing',
    short: 'Boxing',
    icon: '🥊',
    tagline: 'Championship boxing under the bright lights.',
    accent: 'from-amber-600 via-red-700 to-zinc-900',
    description: 'Title fights, undercard wars, and once-in-a-generation bouts.',
  },
  {
    key: 'mlb',
    name: 'MLB',
    short: 'MLB',
    icon: '⚾',
    tagline: 'America’s pastime, played at the highest level.',
    accent: 'from-blue-800 via-blue-700 to-red-700',
    description: 'Home runs, rivalries, and pennant races from the MLB.',
  },
  {
    key: 'olympics',
    name: 'Olympics',
    short: 'Olympics',
    icon: '🏅',
    tagline: 'Faster, higher, stronger — together.',
    accent: 'from-yellow-500 via-amber-500 to-blue-600',
    description:
      'Once-every-four-years moments from track, field, and the global stage.',
  },
]

export function findLeague(key) {
  return SPORTS_LEAGUES.find((l) => l.key === key) || null
}
