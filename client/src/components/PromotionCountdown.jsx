import { useEffect, useState } from 'react'

// Live countdown to a promotion's endsAt. Ticks every second; when
// the timer crosses zero, calls onExpire (parent typically reloads
// the event so the backend response now has no `promotion` field
// and the badge / discounted price disappear on the next render).
//
// Defensive about clock skew — if endsAt was already in the past at
// mount, fires onExpire immediately and renders nothing.
export default function PromotionCountdown({ endsAt, onExpire, compact = false }) {
  const target = parseTarget(endsAt)
  const [remaining, setRemaining] = useState(() =>
    target ? Math.max(0, target - Date.now()) : 0,
  )

  useEffect(() => {
    if (!target) return undefined
    if (target - Date.now() <= 0) {
      if (typeof onExpire === 'function') onExpire()
      return undefined
    }
    const id = setInterval(() => {
      const next = target - Date.now()
      if (next <= 0) {
        clearInterval(id)
        setRemaining(0)
        if (typeof onExpire === 'function') onExpire()
        return
      }
      setRemaining(next)
    }, 1000)
    return () => clearInterval(id)
  }, [target, onExpire])

  if (!target || remaining <= 0) return null
  const parts = breakdown(remaining)

  if (compact) {
    return (
      <span className="font-mono text-xs font-semibold text-white/90 md:text-sm">
        {parts.days}d {pad(parts.hours)}h {pad(parts.minutes)}m {pad(parts.seconds)}s
      </span>
    )
  }

  return (
    <div className="flex items-end gap-3 sm:gap-4">
      <TimeBlock value={parts.days} label="Days" />
      <Separator />
      <TimeBlock value={parts.hours} label="Hours" />
      <Separator />
      <TimeBlock value={parts.minutes} label="Min" />
      <Separator />
      <TimeBlock value={parts.seconds} label="Sec" />
    </div>
  )
}

function TimeBlock({ value, label }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-mono text-2xl font-bold tabular-nums leading-none text-white md:text-3xl">
        {pad(value)}
      </span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-white/70">
        {label}
      </span>
    </div>
  )
}

function Separator() {
  return <span className="text-2xl font-bold text-white/40 md:text-3xl">:</span>
}

function parseTarget(endsAt) {
  if (!endsAt) return null
  const ms = Date.parse(endsAt)
  return Number.isFinite(ms) ? ms : null
}

function breakdown(ms) {
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  return { days, hours, minutes, seconds }
}

function pad(n) {
  return String(n).padStart(2, '0')
}
