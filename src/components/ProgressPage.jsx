import { useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  LIFT_LABEL,
  LIFT_STROKE,
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

export function ProgressPage({ athlete, viewer }) {
  const [focus, setFocus] = useState('all')
  const estimates = latestEstimates(athlete)
  const series = athlete.e1rmSeries || []
  const data = series.map((p) => ({ ...p, label: formatShortDay(p.date) }))
  const first = series[0]
  const lifts = focus === 'all' ? ['squat', 'bench', 'deadlift'] : [focus]
  const logs = [...(athlete.logs || [])].sort((a, b) => b.date.localeCompare(a.date) || (b.setNumber || 0) - (a.setNumber || 0)).slice(0, 12)

  return (
    <div className="grid gap-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{viewer === 'coach' ? athlete.name : 'Your lifting'}</div>
        <h1 className="font-display text-4xl text-white">e1RM over time</h1>
        <p className="text-sm text-zinc-500">Estimated from logged reps, load, and RPE. A day keeps the best estimate for each lift.</p>
      </div>
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
          <div className="font-mono text-xs text-zinc-500">Squat + bench + deadlift</div>
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
