import { useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  LIFT_LABEL,
  LIFT_STROKE,
  calculateDots,
  currentGl,
  estimatedTotalKg,
  fmtKg,
  formatShortDay,
  latestEstimates,
  totalOf,
} from '../domain'
import { Card } from './ui'

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-white/10 bg-[#12141c] px-3 py-2 text-xs">
      <div className="mb-1 text-zinc-400">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>{LIFT_LABEL[p.dataKey]} {fmtKg(p.value)} kg</div>
      ))}
    </div>
  )
}

function fmtGl(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return Number(n).toFixed(1)
}

export function ProgressPage({ athlete, viewer, stint, roster, onBodyweight }) {
  const [focus, setFocus] = useState('all')
  const estimates = latestEstimates(athlete)
  const series = athlete.e1rmSeries || []
  const data = series.map((p) => ({ ...p, label: formatShortDay(p.date) }))
  const first = series[0]
  const lifts = focus === 'all' ? ['squat', 'bench', 'deadlift'] : [focus]
  const logs = [...(athlete.logs || [])].sort((a, b) => b.date.localeCompare(a.date) || (b.setNumber || 0) - (a.setNumber || 0)).slice(0, 12)
  const totalNow = estimatedTotalKg(athlete)
  const glNow = currentGl(athlete)
  const startGl = stint?.startDots ?? null
  const startTotal = stint?.startTotalKg ?? null
  const glDelta = glNow != null && startGl != null ? glNow - startGl : null

  const rosterStats = (roster || []).map((person) => {
    const active = person.activeStint
    const now = currentGl(person)
    const start = active?.startDots
    return {
      id: person.id,
      name: person.name,
      startGl: start,
      nowGl: now,
      delta: now != null && start != null ? now - start : null,
    }
  })
  const rosterDeltas = rosterStats.map((r) => r.delta).filter((d) => d != null)
  const avgDelta = rosterDeltas.length
    ? rosterDeltas.reduce((s, d) => s + d, 0) / rosterDeltas.length
    : null

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{viewer === 'coach' ? athlete.name : 'Your lifting'}</div>
          <h1 className="font-display text-4xl text-white">e1RM & GL</h1>
          <p className="text-sm text-zinc-500">Estimated from logged sets. GL uses the IPF classic formula (shown as DOTS in-product).</p>
        </div>
        <label className="text-sm">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Bodyweight (kg)</div>
          <input
            type="number"
            step="0.1"
            min="30"
            value={athlete.bodyweightKg ?? ''}
            onChange={(e) => onBodyweight?.(e.target.value)}
            className="w-24 rounded-md border border-white/10 bg-[#151821] px-2 py-1 font-mono"
          />
        </label>
      </div>

      {(stint || viewer === 'coach') && (
        <div className="grid gap-2 sm:grid-cols-4">
          <Card className="p-3">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Start total</div>
            <div className="font-display text-3xl text-white">{fmtKg(startTotal)}<span className="ml-1 text-lg text-zinc-500">kg</span></div>
            <div className="font-mono text-[11px] text-zinc-500">{stint?.startedAt ? formatShortDay(stint.startedAt.slice(0, 10)) : '—'}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Start GL</div>
            <div className="font-display text-3xl text-white">{fmtGl(startGl)}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Current GL</div>
            <div className="font-display text-3xl text-white">{fmtGl(glNow)}</div>
            <div className="font-mono text-[11px] text-zinc-500">Total {fmtKg(totalNow)} kg</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Under this coach</div>
            <div className={`font-display text-3xl ${glDelta == null ? 'text-zinc-500' : glDelta >= 0 ? 'text-lime-300' : 'text-orange-300'}`}>
              {glDelta == null ? '—' : `${glDelta >= 0 ? '+' : ''}${fmtGl(glDelta)}`}
            </div>
            <div className="font-mono text-[11px] text-zinc-500">GL delta</div>
          </Card>
        </div>
      )}

      {viewer === 'coach' && rosterStats.length > 0 && (
        <Card className="p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">Roster GL trend</div>
              <div className="font-display text-2xl text-white">
                Avg {avgDelta == null ? '—' : `${avgDelta >= 0 ? '+' : ''}${fmtGl(avgDelta)} GL`}
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-1">
            {rosterStats.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded-lg border border-white/8 px-3 py-2 text-sm">
                <span className="text-zinc-200">{row.name}</span>
                <span className="font-mono text-xs text-zinc-500">
                  {fmtGl(row.startGl)} → {fmtGl(row.nowGl)}
                  <span className={`ml-2 ${row.delta == null ? '' : row.delta >= 0 ? 'text-lime-300' : 'text-orange-300'}`}>
                    {row.delta == null ? '' : `${row.delta >= 0 ? '+' : ''}${fmtGl(row.delta)}`}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-2 sm:grid-cols-4">
        {['squat', 'bench', 'deadlift'].map((lift) => {
          const delta = first && estimates[lift] != null ? Number(estimates[lift]) - Number(first[lift]) : null
          return (
            <Card key={lift} className="p-3">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">{LIFT_LABEL[lift]}</div>
              <div className="font-display text-4xl text-white">{fmtKg(estimates[lift])}<span className="ml-1 text-lg text-zinc-500">kg</span></div>
              {delta != null && (
                <div className={`font-mono text-xs ${delta >= 0 ? 'text-lime-300' : 'text-orange-300'}`}>
                  {delta > 0 ? '+' : ''}{fmtKg(delta)} kg since {formatShortDay(first.date)}
                </div>
              )}
            </Card>
          )
        })}
        <Card className="p-3">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Total</div>
          <div className="font-display text-4xl text-white">{fmtKg(totalOf(estimates))}<span className="ml-1 text-lg text-zinc-500">kg</span></div>
          <div className="font-mono text-xs text-zinc-500">
            GL {fmtGl(calculateDots(totalOf(estimates), athlete.bodyweightKg, athlete.sex))}
          </div>
        </Card>
      </div>
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {[['all', 'All'], ['squat', 'Squat'], ['bench', 'Bench'], ['deadlift', 'Deadlift']].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFocus(id)} className={`rounded-md border px-2 py-1 text-xs uppercase tracking-wider ${focus === id ? 'border-white/30 bg-white/10 text-white' : 'border-white/10 text-zinc-500'}`}>{label}</button>
          ))}
        </div>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 800, height: 320 }}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#ffffff14" vertical={false} />
              <XAxis dataKey="label" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} width={42} domain={['dataMin - 10', 'dataMax + 10']} />
              <Tooltip content={<Tip />} />
              <Legend formatter={(value) => LIFT_LABEL[value] || value} />
              {lifts.map((lift) => (
                <Line key={lift} type="monotone" dataKey={lift} name={lift} stroke={LIFT_STROKE[lift]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="border-b border-white/8 px-4 py-3 text-sm text-zinc-300">Recent set estimates</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-2 py-2 font-medium">Set</th>
                <th className="px-2 py-2 font-medium">Exercise</th>
                <th className="px-2 py-2 font-medium">Kg</th>
                <th className="px-2 py-2 font-medium">Reps</th>
                <th className="px-2 py-2 font-medium">RPE</th>
                <th className="px-4 py-2 font-medium">e1RM</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-white/6">
                  <td className="px-4 py-2 text-zinc-400">{formatShortDay(log.date)}</td>
                  <td className="px-2 py-2">{log.setNumber}</td>
                  <td className="px-2 py-2">{log.exercise}</td>
                  <td className="px-2 py-2 font-mono">{fmtKg(log.weight)}</td>
                  <td className="px-2 py-2 font-mono">{log.reps}</td>
                  <td className="px-2 py-2 font-mono">{log.rpe}</td>
                  <td className="px-4 py-2 font-mono text-lime-300">{log.e1 ? fmtKg(log.e1) : '—'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-zinc-500">No sets logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
