import { useState } from 'react'
import { Film } from 'lucide-react'
import { LIFT_LABEL, WEEKDAYS, formatDay } from '../domain'
import { Card } from './ui'

const FILTERS = [
  ['all', 'All'],
  ['squat', 'Squat'],
  ['bench', 'Bench'],
  ['deadlift', 'Deadlift'],
  ['accessory', 'Accessories'],
]

export function VideosPage({ athlete, role, onOpenDay }) {
  const [filter, setFilter] = useState('all')
  const videos = [...(athlete.videos || [])].sort((a, b) => b.date.localeCompare(a.date) || a.setNumber - b.setNumber)
  const filtered = videos.filter((v) => {
    if (filter === 'all') return true
    if (filter === 'accessory') return !v.lift
    return v.lift === filter
  })
  const groups = []
  for (const video of filtered) {
    const last = groups[groups.length - 1]
    if (!last || last.date !== video.date) groups.push({ date: video.date, items: [video] })
    else last.items.push(video)
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{role === 'coach' ? athlete.name : 'Your clips'}</div>
          <h1 className="font-display text-4xl text-white">Videos</h1>
          <p className="max-w-xl text-sm text-zinc-500">Clips filed on a training day. Each one is captioned with the set number, reps, load, and RPE from the log.</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} className={`rounded-md border px-2 py-1 text-xs uppercase tracking-wider ${filter === id ? 'border-white/30 bg-white/10 text-white' : 'border-white/10 text-zinc-500'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {videos.length === 0 && (
        <Card className="p-8 text-center">
          <Film className="mx-auto text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-400">No set videos yet. Log a set on the training day and attach a clip. The caption is written from that log.</p>
        </Card>
      )}

      {videos.length > 0 && filtered.length === 0 && (
        <Card className="p-6 text-sm text-zinc-500">No clips for this lift.</Card>
      )}

      {groups.map((group) => (
        <section key={group.date} className="grid gap-3">
          <h2 className="font-display text-2xl text-white">{formatDay(group.date)}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.items.map((video) => (
              <Card key={video.id} className="overflow-hidden">
                <div className={`relative aspect-video ${video.lift === 'squat' ? 'bg-violet-950' : video.lift === 'bench' ? 'bg-indigo-950' : video.lift === 'deadlift' ? 'bg-fuchsia-950' : 'bg-zinc-900'}`}>
                  {video.url && video.type.startsWith('video') ? (
                    <video src={video.url} controls playsInline className="h-full w-full bg-black object-contain" />
                  ) : video.url && video.type.startsWith('image') ? (
                    <img src={video.url} alt={video.caption} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col justify-between p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">No clip yet</div>
                      <div className="font-display text-6xl leading-none text-white">Set {video.setNumber}</div>
                      <div className="text-xs uppercase tracking-widest text-zinc-400">{video.lift ? LIFT_LABEL[video.lift] : 'Accessory'}</div>
                    </div>
                  )}
                </div>
                <div className="px-3 py-3">
                  <div className="font-display text-2xl leading-tight text-white">{video.caption}</div>
                  <div className="mt-1 text-sm text-zinc-400">{video.exercise} · {video.label}</div>
                  <div className="text-xs text-zinc-500">
                    {video.weekIndex != null ? `${video.blockName} · Week ${video.weekIndex + 1} · ${WEEKDAYS[video.dayIndex]}` : video.blockName}
                  </div>
                  {video.weekIndex != null && (
                    <button type="button" onClick={() => onOpenDay(video)} className="mt-2 text-xs text-cyan-300">Open this day</button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
