import { useEffect, useState } from 'react'
import { meetMs } from '../domain'

export function Label({ children }) {
  return <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{children}</div>
}

export function Card({ className = '', children }) {
  return <section className={`rounded-xl border border-white/8 bg-[#0e1016] ${className}`}>{children}</section>
}

/**
 * Compact +/− stepper for sets / reps / RPE pacing.
 * Large hit targets so coaches can nudge values quickly without typing.
 */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = null,
  max = null,
  size = 'md',
}) {
  const n = Number(value)
  const safe = Number.isFinite(n) ? n : 0
  function bump(dir) {
    let next = safe + dir * step
    if (min != null) next = Math.max(min, next)
    if (max != null) next = Math.min(max, next)
    const decimals = String(step).includes('.') ? 1 : 0
    onChange(Number(next.toFixed(decimals)))
  }
  const pad = size === 'lg' ? 'min-h-9 min-w-9 text-base' : 'min-h-8 min-w-8 text-sm'
  const field = size === 'lg' ? 'w-11 text-sm' : 'w-9 text-xs'
  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-md border border-white/15 bg-[#151821]">
      <button
        type="button"
        aria-label="Decrease"
        onClick={() => bump(-1)}
        className={`${pad} border-r border-white/10 text-zinc-300 hover:bg-white/10 active:bg-white/15`}
      >
        −
      </button>
      <input
        type="number"
        step={step}
        value={safe}
        onChange={(e) => {
          const next = Number(e.target.value)
          if (!Number.isFinite(next)) return
          let clamped = next
          if (min != null) clamped = Math.max(min, clamped)
          if (max != null) clamped = Math.min(max, clamped)
          onChange(clamped)
        }}
        className={`${field} bg-transparent text-center font-mono text-zinc-100 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
      <button
        type="button"
        aria-label="Increase"
        onClick={() => bump(1)}
        className={`${pad} border-l border-white/10 text-zinc-300 hover:bg-white/10 active:bg-white/15`}
      >
        +
      </button>
    </div>
  )
}

export function Avatar({ id, name, className = '' }) {
  const tone = {
    ola: 'bg-violet-500/30 text-violet-100',
    marcus: 'bg-indigo-500/30 text-indigo-100',
    sofia: 'bg-amber-500/25 text-amber-100',
    sam: 'bg-cyan-400/20 text-cyan-100',
  }[id] || 'bg-white/10 text-zinc-200'
  const letters = name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
  return (
    <div className={`flex items-center justify-center rounded-full font-display tracking-wide ${tone} ${className}`}>
      {letters}
    </div>
  )
}

export function useCountdown(meetDate, enabled) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [enabled])
  const diff = enabled ? Math.max(0, meetMs(meetDate) - now) : 0
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}
