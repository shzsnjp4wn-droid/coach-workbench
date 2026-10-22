import { useRef, useState } from 'react'
import {
  Calendar,
  Eye,
  GripVertical,
  LayoutGrid,
  Link2,
  Plus,
  Scissors,
  SlidersHorizontal,
  Target,
  Trash2,
} from 'lucide-react'
import {
  BLOCK_PALETTE,
  LIFT_LABEL,
  LIFT_TONE,
  QUICK_MOD,
  RANK_LABEL,
  RPE_OPTIONS,
  SET_PRESETS,
  WEEKDAYS,
  dayItems,
  dayTitle,
  defaultExercise,
  emptyWeek,
  fmtKg,
  highCns,
  isPlaced,
  loadFromChart,
  lookupPct,
  makeAccItem,
  makeMainItem,
  makeSetGroup,
  normalizeBlocks,
  runwayWeeks,
  uid,
  weeksOutFrom,
} from '../domain'
import { MesoSheet } from './MesoSheet'
import { Card, Label, useCountdown } from './ui'

export function CoachProgramme({
  client,
  blocks,
  weeks,
  selectedBlockId,
  selectedWeek,
  selectedDay,
  stage,
  setStage,
  setSelectedWeek,
  setSelectedDay,
  selectBlock,
  patchClient,
  patchPlan,
}) {
  const [newAccessory, setNewAccessory] = useState('')
  const [paletteChip, setPaletteChip] = useState(null)
  const [newVar, setNewVar] = useState({ squat: '', bench: '', deadlift: '' })
  const trackRef = useRef(null)
  const dragRef = useRef(null)
  const countdown = useCountdown(client.meetDate, client.planningMode === 'meet')
  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null
  const plan = selectedBlock ? client.plans[selectedBlock.id] : null
  const blockStart = selectedBlock ? blocks.slice(0, blocks.findIndex((b) => b.id === selectedBlock.id)).reduce((s, b) => s + b.weeks, 0) : 0
  const week = plan?.weeks[selectedWeek] || null
  const day = week?.days[selectedDay] || null
  const focusWeek = week || emptyWeek()

  function mapWeeks(p, fn) {
    return p.weeks.map((w, wi) => (p.sameEveryWeek || wi === selectedWeek ? fn(w, wi) : w))
  }

  function splitAfter(weekNumber) {
    patchClient((c) => {
      const source = normalizeBlocks(c.blocks, runwayWeeks(c))
      let cursor = 0
      const next = []
      for (const block of source) {
        const start = cursor + 1
        const end = cursor + block.weeks
        if (weekNumber >= start && weekNumber < end) {
          next.push({ ...block, weeks: weekNumber - start + 1 })
          next.push({ id: uid(), name: `Block ${source.length + 1}`, weeks: end - weekNumber })
        } else next.push(block)
        cursor = end
      }
      return { ...c, blocks: next }
    })
  }
  function mergeAfter(weekNumber) {
    patchClient((c) => {
      const source = normalizeBlocks(c.blocks, runwayWeeks(c))
      let cursor = 0
      const next = []
      for (let i = 0; i < source.length; i += 1) {
        const block = source[i]
        const end = cursor + block.weeks
        const following = source[i + 1]
        if (end === weekNumber && following) {
          next.push({ ...block, weeks: block.weeks + following.weeks })
          cursor = end + following.weeks
          i += 1
        } else {
          next.push(block)
          cursor = end
        }
      }
      return { ...c, blocks: next }
    })
  }
  function onResizeStart(e, index) {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { index, startX: e.clientX, start: blocks.map((b) => b.weeks) }
    window.addEventListener('pointermove', onResizeMove)
    window.addEventListener('pointerup', onResizeEnd)
  }
  function onResizeMove(e) {
    const drag = dragRef.current
    if (!drag || !trackRef.current) return
    const cell = trackRef.current.getBoundingClientRect().width / weeks
    const delta = Math.round((e.clientX - drag.startX) / cell)
    const left = Math.max(1, drag.start[drag.index] + delta)
    const right = Math.max(1, drag.start[drag.index + 1] - delta)
    if (left + right !== drag.start[drag.index] + drag.start[drag.index + 1]) return
    patchClient((c) => ({
      ...c,
      blocks: normalizeBlocks(c.blocks, runwayWeeks(c)).map((b, i) => {
        if (i === drag.index) return { ...b, weeks: left }
        if (i === drag.index + 1) return { ...b, weeks: right }
        return b
      }),
    }))
  }
  function onResizeEnd() {
    dragRef.current = null
    window.removeEventListener('pointermove', onResizeMove)
    window.removeEventListener('pointerup', onResizeEnd)
  }

  function setFrequency(lift, value) {
    const n = Math.max(0, Math.min(5, Number(value)))
    patchPlan((p) => {
      const frequency = { ...p.frequency, [lift]: n }
      const weeksArr = p.weeks.map((w) => ({
        days: w.days.map((d) => ({
          ...d,
          items: dayItems(d).filter((it) => !(it.kind === 'main' && it.lift === lift && it.rank > n)),
        })),
      }))
      return { ...p, frequency, weeks: weeksArr }
    })
  }

  function toggleDay(weekIndex, dayIndex) {
    patchPlan((p) => {
      const currently = p.weeks[weekIndex].days[dayIndex].active
      return {
        ...p,
        weeks: p.weeks.map((w, wi) => {
          if (!p.sameEveryWeek && wi !== weekIndex) return w
          return {
            days: w.days.map((d, di) => (di !== dayIndex ? d : { ...d, active: !currently })),
          }
        }),
      }
    })
    setSelectedWeek(weekIndex)
    setSelectedDay(dayIndex)
  }

  function dropChip(lift, rank, weekIndex, dayIndex) {
    if (!lift) return
    patchPlan((p, c) => {
      const item = makeMainItem(lift, rank, c.liftLibrary)
      return {
        ...p,
        weeks: p.weeks.map((w, wi) => {
          if (!p.sameEveryWeek && wi !== weekIndex) return w
          return {
            days: w.days.map((d, di) => {
              if (di !== dayIndex) {
                return { ...d, items: dayItems(d).filter((it) => !(it.kind === 'main' && it.lift === lift && it.rank === rank)) }
              }
              const without = dayItems(d).filter((it) => !(it.kind === 'main' && it.lift === lift && it.rank === rank))
              return { ...d, active: true, items: [...without, item] }
            }),
          }
        }),
      }
    })
    setSelectedWeek(weekIndex)
    setSelectedDay(dayIndex)
    setPaletteChip(null)
  }

  function removeItem(dayIndex, itemId) {
    patchPlan((p) => ({
      ...p,
      weeks: mapWeeks(p, (w) => ({ days: w.days.map((d, di) => (di !== dayIndex ? d : { ...d, items: dayItems(d).filter((i) => i.id !== itemId) })) })),
    }))
  }

  function updateItem(dayIndex, itemId, partial) {
    patchPlan((p) => ({
      ...p,
      weeks: mapWeeks(p, (w) => ({
        days: w.days.map((d, di) => di !== dayIndex ? d : {
          ...d,
          items: dayItems(d).map((i) => (i.id === itemId ? { ...i, ...partial } : i)),
        }),
      })),
    }))
  }

  function reorderItem(dayIndex, from, to) {
    if (from === to) return
    patchPlan((p) => ({
      ...p,
      weeks: mapWeeks(p, (w) => ({
        days: w.days.map((d, di) => {
          if (di !== dayIndex) return d
          const items = [...dayItems(d)]
          const [moved] = items.splice(from, 1)
          items.splice(to, 0, moved)
          return { ...d, items }
        }),
      })),
    }))
  }

  function addSetGroup(itemId) {
    const item = dayItems(day).find((i) => i.id === itemId)
    const ex = item?.kind === 'main' ? defaultExercise(client.liftLibrary, item.lift) : { name: item?.name, modifier: 0 }
    const group = makeSetGroup(ex, item?.kind === 'main' ? `Set ${(item.setGroups.length || 0) + 1}` : 'Straight', item?.kind === 'main' ? 1 : 3, item?.kind === 'main' ? 5 : 10, item?.kind === 'main' ? 8 : 7)
    patchPlan((p) => ({
      ...p,
      weeks: mapWeeks(p, (w) => ({
        days: w.days.map((d, di) => di !== selectedDay ? d : {
          ...d,
          items: dayItems(d).map((i) => (i.id === itemId ? { ...i, setGroups: [...i.setGroups, group] } : i)),
        }),
      })),
    }))
  }

  function updateGroup(itemId, groupId, partial) {
    patchPlan((p) => ({
      ...p,
      weeks: mapWeeks(p, (w) => ({
        days: w.days.map((d, di) => di !== selectedDay ? d : {
          ...d,
          items: dayItems(d).map((i) => i.id === itemId ? {
            ...i,
            setGroups: i.setGroups.map((g) => (g.id === groupId ? { ...g, ...partial } : g)),
          } : i),
        }),
      })),
    }))
  }

  function updateGroupAt(weekIndex, dayIndex, itemId, groupId, partial) {
    patchPlan((p) => ({
      ...p,
      sameEveryWeek: false,
      weeks: p.weeks.map((w, wi) => wi !== weekIndex ? w : {
        days: w.days.map((d, di) => di !== dayIndex ? d : {
          ...d,
          items: dayItems(d).map((i) => i.id === itemId ? {
            ...i,
            setGroups: i.setGroups.map((g) => (g.id === groupId ? { ...g, ...partial } : g)),
          } : i),
        }),
      }),
    }))
  }

  function addAccessory(name) {
    if (!name) return
    const item = makeAccItem(name)
    patchPlan((p) => ({
      ...p,
      weeks: mapWeeks(p, (w) => ({
        days: w.days.map((d, di) => (di !== selectedDay ? d : { ...d, active: true, items: [...dayItems(d), item] })),
      })),
    }))
  }

  function setSameEveryWeek(value) {
    patchPlan((p) => {
      if (value) {
        const template = p.weeks[selectedWeek] || emptyWeek()
        return { ...p, sameEveryWeek: true, weeks: p.weeks.map(() => JSON.parse(JSON.stringify(template))) }
      }
      return { ...p, sameEveryWeek: false }
    })
  }

  function addVariation(lift, name) {
    const trimmed = name.trim()
    if (!trimmed) return
    patchClient((c) => ({
      ...c,
      liftLibrary: {
        ...c.liftLibrary,
        [lift]: [...c.liftLibrary[lift], { id: uid(), name: trimmed, modifier: 1 }],
      },
    }))
    setNewVar((v) => ({ ...v, [lift]: '' }))
  }

  function setVariationMod(lift, id, modifier) {
    const mod = Math.round(Number(modifier) * 200) / 200
    patchClient((c) => ({
      ...c,
      liftLibrary: {
        ...c.liftLibrary,
        [lift]: c.liftLibrary[lift].map((v) => (v.id === id ? { ...v, modifier: mod } : v)),
      },
    }))
  }

  function applyExerciseToGroup(item, groupId, exerciseName) {
    const lift = item.lift
    const found = lift ? client.liftLibrary[lift].find((v) => v.name === exerciseName) : { name: exerciseName, modifier: 0 }
    updateGroup(item.id, groupId, { exercise: found?.name || exerciseName, modifier: found?.modifier ?? 0 })
  }

  const timeline = []
  let cursor = 1
  blocks.forEach((block, blockIndex) => {
    for (let i = 0; i < block.weeks; i += 1) {
      timeline.push({ week: cursor, block, blockIndex })
      cursor += 1
    }
  })

  return (
    <div className="grid gap-4">
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm text-zinc-300"><Calendar size={16} className="text-cyan-300" /> Macro · {client.name}</div>
            <p className="mt-1 text-xs text-zinc-500">{client.event}. Blocks start unnamed. Rename them if you want.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border border-white/10 p-1">
              {['meet', 'block'].map((mode) => (
                <button key={mode} type="button" onClick={() => patchClient((c) => ({ ...c, planningMode: mode, blocks: normalizeBlocks(c.blocks, mode === 'block' ? c.blockWeeks : weeksOutFrom(c.meetDate)) }))} className={`rounded-md px-3 py-1.5 text-xs uppercase tracking-wider ${client.planningMode === mode ? 'bg-cyan-400 text-black' : 'text-zinc-400'}`}>
                  {mode === 'meet' ? 'Meet prep' : 'Training block'}
                </button>
              ))}
            </div>
            {client.planningMode === 'meet' ? (
              <label className="text-right text-sm">
                <div className="text-white">{client.event}</div>
                <input type="date" value={client.meetDate} onChange={(e) => patchClient((c) => ({ ...c, meetDate: e.target.value, blocks: normalizeBlocks(c.blocks, weeksOutFrom(e.target.value)) }))} className="rounded-md border border-white/10 bg-[#151821] px-2 py-1 text-xs" />
              </label>
            ) : (
              <label>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Weeks</div>
                <input type="number" min="4" max="52" value={client.blockWeeks} onChange={(e) => patchClient((c) => ({ ...c, blockWeeks: Number(e.target.value), blocks: normalizeBlocks(c.blocks, Number(e.target.value) || 16) }))} className="w-16 rounded-md border border-white/10 bg-[#151821] px-2 py-1 font-display text-2xl" />
              </label>
            )}
            {client.planningMode === 'meet' && (
              <div className="flex gap-1.5">
                {[['d', countdown.days], ['h', countdown.hours], ['m', countdown.minutes], ['s', countdown.seconds]].map(([l, v]) => (
                  <div key={l} className="rounded-md border border-white/8 bg-black/40 px-2 py-1 text-center">
                    <div className="font-display text-xl leading-none">{String(v).padStart(2, '0')}</div>
                    <div className="text-[9px] uppercase text-zinc-500">{l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {['squat', 'bench', 'deadlift'].map((lift) => (
            <label key={lift} className="rounded-lg border border-white/8 bg-black/30 px-2 py-1">
              <div className="text-[9px] uppercase tracking-widest text-zinc-500">{lift} PB</div>
              <div className="flex items-baseline gap-2">
                <input type="number" step="2.5" value={client.pbs[lift]} onChange={(e) => patchClient((c) => ({ ...c, pbs: { ...c.pbs, [lift]: Number(e.target.value) } }))} className="w-16 bg-transparent font-display text-xl outline-none" />
                <span className="font-mono text-[10px] text-lime-300/80">e1 {fmtKg(client.e1rm[lift])}</span>
              </div>
            </label>
          ))}
        </div>
        <div className="overflow-x-auto" ref={trackRef}>
          <div className="min-w-[860px]">
            <div className="relative mb-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0,1fr))` }}>
              {blocks.map((block, i) => (
                <button key={block.id} type="button" onClick={() => selectBlock(block.id)} style={{ gridColumn: `span ${block.weeks}` }} className={`relative rounded-lg border px-3 py-2 text-left ${BLOCK_PALETTE[i % 4].surface} ${selectedBlockId === block.id ? 'ring-2 ring-cyan-400' : ''}`}>
                  <input value={block.name} onClick={(e) => e.stopPropagation()} onChange={(e) => patchClient((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === block.id ? { ...b, name: e.target.value } : b)) }))} className="w-full bg-transparent text-sm font-medium outline-none" />
                  <div className="text-[11px] text-zinc-400">{block.weeks} wk · click to plan</div>
                  {i < blocks.length - 1 && (
                    <span onPointerDown={(e) => onResizeStart(e, i)} className="absolute -right-1.5 top-1/2 z-10 h-8 w-3 -translate-y-1/2 cursor-ew-resize rounded-full border border-cyan-400/40 bg-[#0e1016]" />
                  )}
                </button>
              ))}
            </div>
            <div className="relative grid gap-1" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0,1fr))` }}>
              {timeline.map((cell) => (
                <div key={cell.week} className={`rounded-lg border bg-[#10131a] px-1.5 py-2 ${BLOCK_PALETTE[cell.blockIndex % 4].chip}`}>
                  <div className="font-display text-sm text-white">Wk {cell.week}</div>
                </div>
              ))}
              {timeline.slice(0, -1).map((cell, index) => {
                const next = timeline[index + 1]
                const split = cell.block.id !== next.block.id
                return (
                  <button key={`e${cell.week}`} type="button" onClick={() => (split ? mergeAfter(cell.week) : splitAfter(cell.week))} style={{ left: `${((index + 1) / weeks) * 100}%` }} className="absolute top-1/2 z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#0e1016] text-zinc-400">
                    {split ? <Link2 size={10} /> : <Scissors size={10} />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      {selectedBlock && plan && (
        <>
          <div className="flex flex-wrap gap-2">
            {[['micro', '2 Micro'], ['day', '3 Day'], ['meso', '4 Mesocycle sheet'], ['library', 'Variations']].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setStage(id)} className={`rounded-lg border px-3 py-1.5 text-xs uppercase tracking-wider ${stage === id ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/10 text-zinc-400'}`}>{label}</button>
            ))}
          </div>

          {(stage === 'micro' || stage === 'day') && (
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm text-zinc-300"><LayoutGrid size={16} className="text-cyan-300" /> Micro · {selectedBlock.name}</div>
                  <p className="mt-1 text-xs text-zinc-500">Frequency creates 1°/2°/3° chips. Grey days are rest. Scroll to see the same weekday in neighbouring weeks.</p>
                </div>
                <label className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs">
                  <input type="checkbox" checked={plan.sameEveryWeek} onChange={(e) => setSameEveryWeek(e.target.checked)} />
                  Same microcycle every week
                </label>
              </div>
              <div className="mb-3 flex flex-wrap items-end gap-4">
                {['squat', 'bench', 'deadlift'].map((lift) => (
                  <div key={lift}>
                    <Label>{LIFT_LABEL[lift]} frequency</Label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setFrequency(lift, plan.frequency[lift] - 1)} className="h-7 w-7 rounded border border-white/10">−</button>
                      <span className="w-6 text-center font-display text-xl">{plan.frequency[lift]}</span>
                      <button type="button" onClick={() => setFrequency(lift, plan.frequency[lift] + 1)} className="h-7 w-7 rounded border border-white/10">+</button>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Array.from({ length: plan.frequency[lift] }, (_, i) => i + 1).map((rank) => {
                        const placed = isPlaced(focusWeek, lift, rank)
                        return (
                          <button
                            key={`${lift}-${rank}`}
                            type="button"
                            draggable={!placed}
                            onDragStart={(e) => e.dataTransfer.setData('text/plain', `${lift}:${rank}`)}
                            onClick={() => setPaletteChip(placed ? null : { lift, rank })}
                            className={`rounded-md border px-2 py-1 text-xs ${LIFT_TONE[lift]} ${placed ? 'opacity-35' : ''} ${paletteChip?.lift === lift && paletteChip?.rank === rank ? 'ring-2 ring-white' : ''}`}
                          >
                            {RANK_LABEL[rank]} {LIFT_LABEL[lift]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto">
                <div className="flex min-w-max gap-3 pb-2">
                  {plan.weeks.map((wk, wi) => (
                    <div key={wi} className={`rounded-xl border p-2 ${wi === selectedWeek ? 'border-cyan-400/60 bg-cyan-400/5' : 'border-white/8 opacity-45 hover:opacity-70'}`}>
                      <button type="button" onClick={() => setSelectedWeek(wi)} className="mb-2 font-display text-sm text-white">Week {wi + 1}</button>
                      <div className="flex gap-1">
                        {wk.days.map((d, di) => (
                          <div
                            key={d.id}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault()
                              const [lift, rank] = e.dataTransfer.getData('text/plain').split(':')
                              dropChip(lift, Number(rank), wi, di)
                            }}
                            onClick={() => {
                              if (paletteChip) dropChip(paletteChip.lift, paletteChip.rank, wi, di)
                              else if (!d.active) toggleDay(wi, di)
                              else { setSelectedWeek(wi); setSelectedDay(di); setStage('day') }
                            }}
                            className={`w-[108px] rounded-lg border p-1.5 ${d.active ? 'border-white/15 bg-[#10131a]' : 'border-dashed border-white/10 bg-transparent text-zinc-600'} ${highCns(d) ? 'border-orange-500/60' : ''}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase tracking-wider">{WEEKDAYS[di].slice(0, 3)}</span>
                              <button type="button" onClick={(e) => { e.stopPropagation(); toggleDay(wi, di) }} className="text-[9px] uppercase text-zinc-500">{d.active ? 'on' : 'rest'}</button>
                            </div>
                            {d.active ? (
                              <div className="mt-1 grid gap-1">
                                {dayItems(d).filter((i) => i.kind === 'main').map((m) => (
                                  <div key={m.id} className={`rounded px-1 py-0.5 text-[10px] ${LIFT_TONE[m.lift]}`}>{RANK_LABEL[m.rank]} {LIFT_LABEL[m.lift]}</div>
                                ))}
                                {dayItems(d).filter((i) => i.kind === 'main').length === 0 && <div className="py-4 text-center text-[10px] text-zinc-600">Drop</div>}
                              </div>
                            ) : (
                              <div className="py-5 text-center text-[10px]">Rest</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {stage === 'day' && day && (
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <Target size={16} className="text-cyan-300" /> {WEEKDAYS[selectedDay]} · {dayTitle(day)}
                </div>
                <button type="button" onClick={() => setStage('library')} className="text-xs text-cyan-300"><SlidersHorizontal size={12} className="mr-1 inline" />Variation library</button>
              </div>
              {!day.active && <p className="text-sm text-zinc-500">This is a rest day. Turn it on in the micro strip if you want work here.</p>}
              <div className="grid gap-3">
                {dayItems(day).map((item, index) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', String(index))}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); reorderItem(selectedDay, Number(e.dataTransfer.getData('text/plain')), index) }}
                    className="rounded-xl border border-white/8 bg-black/25 p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <GripVertical size={14} className="text-zinc-500" />
                      <div className="font-display text-xl text-white">
                        {item.kind === 'main' ? `${RANK_LABEL[item.rank]} ${LIFT_LABEL[item.lift]}` : item.name}
                      </div>
                      <button type="button" onClick={() => removeItem(selectedDay, item.id)} className="ml-auto text-zinc-500 hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                    {item.setGroups.map((g) => (
                      <div key={g.id} className="mb-2 grid grid-cols-2 gap-2 rounded-lg border border-white/8 p-2 sm:grid-cols-8">
                        <label className="col-span-2">
                          <Label>Label</Label>
                          <input list="set-presets" value={g.label} onChange={(e) => updateGroup(item.id, g.id, { label: e.target.value })} className="w-full rounded-md border border-white/10 bg-[#151821] px-2 py-1 text-sm" />
                        </label>
                        {item.kind === 'main' && (
                          <label className="col-span-2">
                            <Label>Exercise</Label>
                            <select value={g.exercise} onChange={(e) => applyExerciseToGroup(item, g.id, e.target.value)} className="w-full rounded-md border border-white/10 bg-[#151821] px-2 py-1 text-sm">
                              {client.liftLibrary[item.lift].map((v) => <option key={v.id} value={v.name}>{v.name} · {Math.round(v.modifier * 100)}%</option>)}
                            </select>
                          </label>
                        )}
                        <label>
                          <Label>Sets</Label>
                          <input type="number" min="1" value={g.count} onChange={(e) => updateGroup(item.id, g.id, { count: Number(e.target.value) })} className="w-full rounded-md border border-white/10 bg-[#151821] px-2 py-1 text-sm" />
                        </label>
                        <label>
                          <Label>Reps</Label>
                          <input type="number" min="1" max="12" value={g.reps} onChange={(e) => updateGroup(item.id, g.id, { reps: Number(e.target.value) })} className="w-full rounded-md border border-white/10 bg-[#151821] px-2 py-1 text-sm" />
                        </label>
                        <label>
                          <Label>RPE</Label>
                          <select value={g.rpe} onChange={(e) => updateGroup(item.id, g.id, { rpe: Number(e.target.value) })} className="w-full rounded-md border border-white/10 bg-[#151821] px-2 py-1 text-sm">
                            {RPE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </label>
                        <label>
                          <Label>Floor</Label>
                          <input type="number" step="2.5" placeholder="—" value={g.floor} onChange={(e) => updateGroup(item.id, g.id, { floor: e.target.value })} className="w-full rounded-md border border-white/10 bg-[#151821] px-2 py-1 text-sm" />
                        </label>
                        <label>
                          <Label>Cap</Label>
                          <input type="number" step="2.5" placeholder="—" value={g.cap} onChange={(e) => updateGroup(item.id, g.id, { cap: e.target.value })} className="w-full rounded-md border border-white/10 bg-[#151821] px-2 py-1 text-sm" />
                        </label>
                        {item.kind === 'main' && (
                          <div className="col-span-2 text-[11px] text-zinc-500 sm:col-span-8">
                            Chart ~ {fmtKg(loadFromChart(client.pbs[item.lift], g.reps, g.rpe, g.modifier))} kg ({(g.modifier * lookupPct(g.reps, g.rpe) * 100).toFixed(1)}% of {fmtKg(client.pbs[item.lift])} PB · {g.exercise} ×{g.modifier.toFixed(2)})
                            <button type="button" onClick={() => updateItem(selectedDay, item.id, { setGroups: item.setGroups.filter((x) => x.id !== g.id) })} className="ml-2 text-zinc-500 hover:text-red-400"><Trash2 size={12} className="inline" /></button>
                          </div>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => addSetGroup(item.id)} className="inline-flex items-center gap-1 rounded-md border border-dashed border-white/15 px-3 py-1.5 text-xs text-zinc-400">
                      <Plus size={12} /> Add set
                    </button>
                  </div>
                ))}
              </div>
              <datalist id="set-presets">{SET_PRESETS.map((n) => <option key={n} value={n} />)}</datalist>
              <div className="mt-4">
                <Label>Add accessory block</Label>
                <select defaultValue="" onChange={(e) => { addAccessory(e.target.value); e.target.value = '' }} className="rounded-md border border-white/10 bg-[#151821] px-2 py-2 text-sm">
                  <option value="" disabled>From library</option>
                  {client.accessoryLibrary.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                </select>
              </div>
            </Card>
          )}

          {stage === 'library' && (
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2 text-sm text-zinc-300"><SlidersHorizontal size={16} className="text-cyan-300" /> Lift variation library</div>
              <p className="mb-4 text-xs text-zinc-500">Comp lifts start at 100% of that lift’s PB. Add a variation, then snap it to 80–95% or fine-tune.</p>
              <div className="grid gap-4 lg:grid-cols-3">
                {['squat', 'bench', 'deadlift'].map((lift) => (
                  <div key={lift} className="rounded-xl border border-white/8 p-3">
                    <div className="font-display text-xl text-white">{LIFT_LABEL[lift]}</div>
                    <div className="mt-2 flex gap-2">
                      <input value={newVar[lift]} onChange={(e) => setNewVar((v) => ({ ...v, [lift]: e.target.value }))} placeholder="Add variation" className="w-full rounded-md border border-white/10 bg-[#151821] px-2 py-1.5 text-sm" />
                      <button type="button" onClick={() => addVariation(lift, newVar[lift])} className="rounded-md bg-white/10 px-2"><Plus size={14} /></button>
                    </div>
                    <div className="mt-3 grid gap-3">
                      {client.liftLibrary[lift].map((v) => (
                        <div key={v.id} className="rounded-lg border border-white/8 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <input value={v.name} onChange={(e) => patchClient((c) => ({ ...c, liftLibrary: { ...c.liftLibrary, [lift]: c.liftLibrary[lift].map((x) => (x.id === v.id ? { ...x, name: e.target.value } : x)) } }))} className="bg-transparent text-sm outline-none" />
                            <span className="font-mono text-lime-300">{Math.round(v.modifier * 100)}%</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {QUICK_MOD.map((q) => (
                              <button key={q} type="button" onClick={() => setVariationMod(lift, v.id, q)} className={`rounded px-1.5 py-0.5 text-[10px] ${Math.abs(v.modifier - q) < 0.001 ? 'bg-cyan-400 text-black' : 'bg-white/8 text-zinc-400'}`}>{Math.round(q * 100)}</button>
                            ))}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <button type="button" onClick={() => setVariationMod(lift, v.id, v.modifier - 0.005)} className="h-6 w-6 rounded border border-white/10 text-xs">−</button>
                            <input type="range" min="0.7" max="1.05" step="0.005" value={v.modifier} onChange={(e) => setVariationMod(lift, v.id, e.target.value)} className="flex-1" />
                            <button type="button" onClick={() => setVariationMod(lift, v.id, v.modifier + 0.005)} className="h-6 w-6 rounded border border-white/10 text-xs">+</button>
                          </div>
                          {v.name !== `Comp ${LIFT_LABEL[lift]}` && (
                            <button type="button" onClick={() => patchClient((c) => ({ ...c, liftLibrary: { ...c.liftLibrary, [lift]: c.liftLibrary[lift].filter((x) => x.id !== v.id) } }))} className="mt-1 text-[10px] text-zinc-500 hover:text-red-400">Remove</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Label>Accessory library</Label>
                <div className="mb-2 flex gap-2">
                  <input value={newAccessory} onChange={(e) => setNewAccessory(e.target.value)} placeholder="New accessory" className="rounded-md border border-white/10 bg-[#151821] px-2 py-1.5 text-sm" />
                  <button type="button" onClick={() => { if (!newAccessory.trim()) return; patchClient((c) => ({ ...c, accessoryLibrary: [...c.accessoryLibrary, { id: uid(), name: newAccessory.trim(), group: 'custom' }] })); setNewAccessory('') }} className="rounded-md bg-white/10 px-2"><Plus size={14} /></button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {client.accessoryLibrary.map((a) => (
                    <span key={a.id} className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-xs">
                      {a.name}
                      <button type="button" onClick={() => patchClient((c) => ({ ...c, accessoryLibrary: c.accessoryLibrary.filter((x) => x.id !== a.id) }))}><Trash2 size={10} /></button>
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {stage === 'meso' && (
            <Card className="overflow-hidden p-0">
              <div className="border-b border-white/8 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-zinc-300"><Eye size={16} className="text-cyan-300" /> Mesocycle sheet · {selectedBlock.name}</div>
              </div>
              <MesoSheet
                plan={plan}
                client={client}
                selectedBlock={selectedBlock}
                blockStart={blockStart}
                totalWeeks={weeks}
                readOnly={false}
                overrides={client.scheduleOverrides}
                onPickDay={(wi, di) => { setSelectedWeek(wi); setSelectedDay(di); setStage('day') }}
                onEditGroup={updateGroupAt}
              />
            </Card>
          )}
        </>
      )}
    </div>
  )
}
