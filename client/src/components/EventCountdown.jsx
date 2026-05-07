import { useEffect, useState } from 'react'

function pad(n) {
  return String(Math.max(0, n)).padStart(2, '0')
}

export default function EventCountdown({
  targetDate,
  variant = 'hero',
  className = '',
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!targetDate) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [targetDate])

  if (!targetDate) return null
  const remaining = targetDate.getTime() - now
  if (remaining <= 0) return null

  const days = Math.floor(remaining / 86400000)
  const hours = Math.floor((remaining % 86400000) / 3600000)
  const mins = Math.floor((remaining % 3600000) / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)

  const isHero = variant === 'hero'

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      aria-label="Event countdown"
    >
      <Box value={days} label="Days" hero={isHero} />
      <Sep hero={isHero} />
      <Box value={pad(hours)} label="Hrs" hero={isHero} />
      <Sep hero={isHero} />
      <Box value={pad(mins)} label="Min" hero={isHero} />
      <Sep hero={isHero} />
      <Box value={pad(secs)} label="Sec" hero={isHero} />
    </div>
  )
}

function Box({ value, label, hero }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-md ${
        hero
          ? 'min-w-[58px] bg-white/15 px-3 py-2 text-white backdrop-blur'
          : 'min-w-[44px] bg-blue-50 px-2 py-1.5 text-brand'
      }`}
    >
      <span
        className={`tabular-nums font-bold transition-all ${
          hero ? 'text-2xl md:text-3xl' : 'text-lg'
        }`}
      >
        {value}
      </span>
      <span
        className={`uppercase tracking-wider ${
          hero ? 'text-[10px] text-white/80' : 'text-[9px] text-brand/70'
        }`}
      >
        {label}
      </span>
    </div>
  )
}

function Sep({ hero }) {
  return (
    <span
      aria-hidden
      className={`text-2xl font-bold ${hero ? 'text-white/40' : 'text-brand/30'}`}
    >
      :
    </span>
  )
}
