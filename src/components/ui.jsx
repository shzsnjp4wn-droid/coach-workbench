import { useEffect, useState } from 'react'
import { meetMs } from '../domain'

export function Label({ children }) {
  return <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{children}</div>
}

export function Card({ className = '', children }) {
  return <section className={`rounded-xl border border-white/8 bg-[#0e1016] ${className}`}>{children}</section>
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
