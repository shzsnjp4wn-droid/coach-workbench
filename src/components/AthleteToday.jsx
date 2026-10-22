import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Dumbbell, Upload, Video } from 'lucide-react'
import {
  LIFT_TONE,
  RPE_OPTIONS,
  WEEKDAYS,
  calendarDate,
  dayTitle,
  expandDaySets,
  findLog,
  formatMeetDate,
  highCns,
  isoFromDate,
  sessionAt,
  setCaption,
  todayISO,
  fileToMedia,
  fmtKg,
} from '../domain'
import { Card } from './ui'

export function AthleteToday({
  client,
  blocks,
  plan,
  selectedBlock,
  selectedBlockId,
  selectedWeek,
  selectedDay,
  blockStart,
  totalWeeks,
  onSelectBlock,
  onSelectWeek,
  onSelectDay,
  onCommit,
}) {
  const [drafts, setDrafts] = useState({})
  const [mismatch, setMismatch] = useState(null)
  const logsRef = useRef(client.logs)
  const clientRef = useRef(client)
  const planRef = useRef(plan)
  logsRef.current = client.logs
  clientRef.current = client
  planRef.current = plan
  const day = plan?.weeks?.[selectedWeek]?.days?.[selectedDay] || null
  const rows = day?.active ? expandDaySets(day, client) : []
  const rowSig = rows.map((r) => r.setKey).join('|')
  const dayId = `${selectedBlockId}:${selectedWeek}:${selectedDay}`
  const todayHit = plan ? sessionAt(client.startDate, plan, todayISO()) : null
  const selectedDate = plan ? isoFromDate(calendarDate(client.startDate, selectedWeek, selectedDay)) : null
  const viewingToday = todayHit && todayHit.weekIndex === selectedWeek && todayHit.dayIndex === selectedDay

  useEffect(() => {
    const current = clientRef.current
    const source = planRef.current?.weeks?.[selectedWeek]?.days?.[selectedDay]
    const expanded = source?.active ? expandDaySets(source, current) : []
    const next = {}
    for (const row of expanded) {
      const existing = findLog(logsRef.current, selectedBlockId, selectedWeek, selectedDay, row.setKey)
      next[row.setKey] = {
        weight: existing ? String(existing.weight) : (row.prescribedKg ?? ''),
        reps: existing ? String(existing.reps) : String(row.prescribedReps),
        rpe: existing ? String(existing.rpe) : String(row.prescribedRpe),
        media: null,
      }
    }
    setDrafts(next)
  }, [dayId, rowSig, selectedBlockId, selectedWeek, selectedDay])

  function shiftWeek(delta) {
    if (!plan) return
    const next = selectedWeek + delta
    if (next < 0 || next >= plan.weeks.length) return
    onSelectWeek(next)
  }

  function commitRow(row, shifted, date) {
    const draft = drafts[row.setKey]
    const weight = Number(draft?.weight)
    const reps = Number(draft?.reps)
    const rpe = Number(draft?.rpe)
    if (!weight || !reps || !rpe) return
    onCommit({
      block: selectedBlock,
      weekIndex: selectedWeek,
      dayIndex: selectedDay,
      row,
      weight,
      reps,
      rpe,
      shifted,
      date,
      media: draft.media,
    })
    setDrafts((d) => ({ ...d, [row.setKey]: { ...d[row.setKey], media: null } }))
    setMismatch(null)
  }

  function attempt(row) {
    const prescribed = isoFromDate(calendarDate(client.startDate, selectedWeek, selectedDay))
    if (prescribed !== todayISO()) {
      const today = new Date()
      setMismatch({
        row,
        prescribedISO: prescribed,
        prescribedWeekday: WEEKDAYS[selectedDay],
        actualWeekday: WEEKDAYS[(today.getDay() + 6) % 7],
      })
      return
    }
    commitRow(row, false, prescribed)
  }

  const weeksOut = selectedBlock && client.planningMode === 'meet'
    ? `${totalWeeks - (blockStart + selectedWeek)}w out`
    : selectedBlock ? `Block week ${selectedWeek + 1}` : ''

  return (
    <div className="grid gap-4">
      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-lime-300"><Dumbbell size={16} /> {viewingToday ? 'Today' : 'Session'}</div>
            <h1 className="font-display text-4xl text-white">{day ? dayTitle(day) : 'No session'}</h1>
            <p className="text-sm text-zinc-500">
              {selectedBlock ? `${selectedBlock.name} · Week ${selectedWeek + 1}` : 'No block published'}
              {selectedDate ? ` · ${formatMeetDate(selectedDate)}` : ''}
              {weeksOut ? ` · ${weeksOut}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={selectedBlockId || ''} onChange={(e) => onSelectBlock(e.target.value)} className="rounded-md border border-white/10 bg-[#151821] px-2 py-1.5 text-sm">
              {blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button type="button" onClick={() => shiftWeek(-1)} className="rounded-md border border-white/10 p-1.5" aria-label="Previous week"><ChevronLeft size={16} /></button>
            <span className="font-display text-lg text-white">Week {selectedWeek + 1}</span>
            <button type="button" onClick={() => shiftWeek(1)} className="rounded-md border border-white/10 p-1.5" aria-label="Next week"><ChevronRight size={16} /></button>
            {todayHit && !viewingToday && (
              <button type="button" onClick={() => { onSelectWeek(todayHit.weekIndex); onSelectDay(todayHit.dayIndex) }} className="rounded-md bg-lime-400 px-3 py-1.5 text-xs font-semibold text-black">Jump to today</button>
            )}
          </div>
        </div>

        {plan && (
          <div className="overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-7 gap-1">
            {plan.weeks[selectedWeek].days.map((d, di) => {
              const logged = client.logs.some((l) => l.blockId === selectedBlockId && l.weekIndex === selectedWeek && l.dayIndex === di)
              const isToday = todayHit && todayHit.weekIndex === selectedWeek && todayHit.dayIndex === di
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelectDay(di)}
                  className={`rounded-lg border px-1 py-2 text-left ${di === selectedDay ? 'border-lime-400/70 bg-lime-400/10' : 'border-white/10 bg-black/20'} ${d.active ? '' : 'opacity-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400">{WEEKDAYS[di].slice(0, 3)}</span>
                    {logged && <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />}
                  </div>
                  <div className="mt-1 truncate text-[11px] text-zinc-200">{dayTitle(d)}</div>
                  {isToday && <div className="mt-1 text-[9px] uppercase tracking-widest text-lime-300">Today</div>}
                </button>
              )
            })}
          </div>
          </div>
        )}
      </Card>

      {!plan || !day ? (
        <Card className="p-4 text-sm text-zinc-500">Nothing published for this block yet.</Card>
      ) : !day.active ? (
        <Card className="p-4 text-sm text-zinc-400">Rest day.</Card>
      ) : rows.length === 0 ? (
        <Card className="p-4 text-sm text-zinc-400">Nothing programmed for this day.</Card>
      ) : (
        <div className="grid gap-3">
          {highCns(day) && <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-sm text-orange-100">Primary squat and primary deadlift are both on this day.</div>}
          {rows.map((row) => {
            const existing = findLog(client.logs, selectedBlockId, selectedWeek, selectedDay, row.setKey)
            const draft = drafts[row.setKey] || {
              weight: existing ? String(existing.weight) : (row.prescribedKg ?? ''),
              reps: existing ? String(existing.reps) : String(row.prescribedReps),
              rpe: existing ? String(existing.rpe) : String(row.prescribedRpe),
              media: null,
            }
            const video = existing?.videoId ? client.videos.find((v) => v.id === existing.videoId) : null
            const caption = setCaption({
              setNumber: row.setNumber,
              reps: draft.reps || row.prescribedReps,
              weight: draft.weight || '—',
              rpe: draft.rpe || row.prescribedRpe,
            })
            return (
              <Card key={row.setKey} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Set {row.setNumber}{row.count > 1 ? ` · ${row.label} ${row.indexInGroup + 1}/${row.count}` : ''}</div>
                    <div className={`mt-1 inline-flex rounded-md border px-2 py-0.5 text-sm ${row.lift ? LIFT_TONE[row.lift] : 'border-white/10 bg-white/5 text-zinc-200'}`}>{row.exercise}</div>
                    <div className="mt-1 text-sm text-zinc-400">
                      {row.label} · prescribed {row.prescribedReps} @ RPE {row.prescribedRpe}
                      {row.prescribedKg ? ` · ${fmtKg(row.prescribedKg)} kg` : ''}
                      {(row.floor || row.cap) && <span className="ml-2 text-xs">{row.floor ? `floor ${row.floor}` : ''} {row.cap ? `cap ${row.cap}` : ''}</span>}
                    </div>
                  </div>
                  {existing && <div className="rounded-full border border-lime-400/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-lime-300">Logged</div>}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <label>
                    <span className="mb-1 block text-[10px] uppercase tracking-widest text-zinc-500">Kg</span>
                    <input type="number" step="2.5" value={draft.weight} onChange={(e) => setDrafts((d) => ({ ...d, [row.setKey]: { ...(d[row.setKey] || draft), weight: e.target.value } }))} className="w-full rounded-lg border border-white/10 bg-[#151821] px-3 py-2" />
                  </label>
                  <label>
                    <span className="mb-1 block text-[10px] uppercase tracking-widest text-zinc-500">Reps</span>
                    <input type="number" value={draft.reps} onChange={(e) => setDrafts((d) => ({ ...d, [row.setKey]: { ...(d[row.setKey] || draft), reps: e.target.value } }))} className="w-full rounded-lg border border-white/10 bg-[#151821] px-3 py-2" />
                  </label>
                  <label>
                    <span className="mb-1 block text-[10px] uppercase tracking-widest text-zinc-500">RPE</span>
                    <select value={draft.rpe} onChange={(e) => setDrafts((d) => ({ ...d, [row.setKey]: { ...(d[row.setKey] || draft), rpe: e.target.value } }))} className="w-full rounded-lg border border-white/10 bg-[#151821] px-3 py-2">
                      {RPE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm">
                    {draft.media || video?.url ? <Video size={14} /> : <Upload size={14} />}
                    {draft.media ? draft.media.name : video?.url ? 'Replace clip' : 'Add clip'}
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (!file) return
                        setDrafts((d) => ({ ...d, [row.setKey]: { ...(d[row.setKey] || draft), media: fileToMedia(file) } }))
                      }}
                    />
                  </label>
                  <button type="button" onClick={() => attempt(row)} className="rounded-lg bg-lime-400 px-4 py-2 text-sm font-semibold text-black">
                    {existing ? 'Update set' : 'Log set'}
                  </button>
                </div>
                <div className="mt-3 rounded-lg border border-white/8 bg-black/30 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Video caption</div>
                  <div className="font-display text-xl text-white">{caption}</div>
                  {video && !draft.media && <div className="mt-1 text-[11px] text-zinc-500">{video.url ? 'Clip is in Videos.' : 'Caption is in Videos. Add a clip to attach the file.'}</div>}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {mismatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-md rounded-2xl border border-white/10 bg-[#12141c] p-5">
            <div className="font-display text-2xl text-white">Did you do this workout today?</div>
            <p className="mt-2 text-sm text-zinc-400">
              This session was prescribed for {mismatch.prescribedWeekday}. Today is {mismatch.actualWeekday}. Confirming tags the mesocycle for you and your coach.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => commitRow(mismatch.row, true, todayISO())} className="rounded-lg bg-lime-400 px-4 py-2 text-sm font-semibold text-black">Yes, I did it today</button>
              <button type="button" onClick={() => commitRow(mismatch.row, false, mismatch.prescribedISO)} className="rounded-lg border border-white/15 px-4 py-2 text-sm">No, log against prescribed day</button>
              <button type="button" onClick={() => setMismatch(null)} className="px-3 text-sm text-zinc-500">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
