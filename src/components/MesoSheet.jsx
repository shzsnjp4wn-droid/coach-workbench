import { fmtKg, loadFromChart, RANK_LABEL, WEEKDAYS, dayItems, dayTitle } from '../domain'

export function MesoSheet({
  plan,
  client,
  selectedBlock,
  blockStart,
  totalWeeks,
  readOnly,
  onPickDay,
  onEditGroup,
  overrides,
  selectedWeekIndex = null,
  selectedDayIndex = null,
  focusWeekOnly = false,
}) {
  const weeks = focusWeekOnly && selectedWeekIndex != null
    ? plan.weeks.map((wk, wi) => ({ wk, wi })).filter(({ wi }) => wi === selectedWeekIndex)
    : plan.weeks.map((wk, wi) => ({ wk, wi }))

  return (
    <div className="overflow-x-auto">
      <div className={`flex ${focusWeekOnly ? 'justify-stretch' : 'min-w-max'}`}>
        {weeks.map(({ wk, wi }) => (
          <div
            key={wi}
            className={`shrink-0 border-r border-white/8 ${focusWeekOnly ? 'w-full min-w-0' : 'w-[220px]'}`}
          >
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#151821] px-2 py-2">
              <div className="font-display text-lg text-white">Week {wi + 1}</div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                {client.planningMode === 'meet' ? `${totalWeeks - (blockStart + wi)}w out` : `Block wk ${wi + 1}`}
              </div>
            </div>
            {wk.days.map((d, di) => {
              const override = overrides?.find((o) => o.blockId === selectedBlock.id && o.weekIndex === wi && o.dayIndex === di)
              const selected = selectedWeekIndex === wi && selectedDayIndex === di
              return (
                <div
                  key={d.id}
                  className={`border-b border-white/8 transition ${d.active ? '' : 'opacity-45'} ${selected ? 'ring-2 ring-inset ring-lime-400/70' : 'hover:ring-1 hover:ring-inset hover:ring-white/25'}`}
                >
                  <button
                    type="button"
                    onClick={() => onPickDay?.(wi, di)}
                    className="flex w-full items-center justify-between bg-white/4 px-2 py-1.5 text-left"
                  >
                    <span className="text-[11px] uppercase tracking-widest text-zinc-400">{WEEKDAYS[di].slice(0, 3)}</span>
                    <span className="truncate pl-2 text-[11px] text-violet-200">{dayTitle(d)}</span>
                  </button>
                  {override && (
                    <div className="bg-amber-400/15 px-2 py-1 text-[10px] uppercase tracking-wider text-amber-200">
                      Done {override.actualWeekday} (prescribed {override.prescribedWeekday})
                    </div>
                  )}
                  {!d.active ? (
                    <div className="px-2 py-2 text-[11px] text-zinc-600">Rest</div>
                  ) : (
                    <div className="px-1.5 py-1">
                      <div className="mb-1 grid grid-cols-[minmax(0,1fr)_1.5rem_1.75rem_2rem] gap-0.5 text-[8px] uppercase tracking-wider text-zinc-600">
                        <span>Set</span>
                        <span className="text-center">n</span>
                        <span className="text-center">reps</span>
                        <span className="text-center">RPE</span>
                      </div>
                      {dayItems(d).flatMap((item) => item.setGroups.map((g) => {
                        const kg = item.kind === 'main'
                          ? fmtKg(loadFromChart(client.pbs[item.lift], g.reps, g.rpe, g.modifier))
                          : (g.cap || '—')
                        return (
                          <div
                            key={g.id}
                            className={`mb-1 rounded px-1 py-1 ${item.kind === 'accessory' ? 'bg-white/4 text-zinc-400' : item.lift === 'squat' ? 'bg-violet-600/25' : item.lift === 'bench' ? 'bg-indigo-600/20' : 'bg-fuchsia-700/20'}`}
                          >
                            <div className="grid grid-cols-[minmax(0,1fr)_1.5rem_1.75rem_2rem] items-start gap-0.5 text-[10px]">
                              <div className="min-w-0 truncate leading-tight">
                                {item.kind === 'main' ? `${RANK_LABEL[item.rank]} ${g.exercise}` : item.name}
                                <span className="text-zinc-500"> · {g.label}</span>
                              </div>
                              <div className="text-center">
                                {readOnly ? g.count : (
                                  <input type="number" value={g.count} onChange={(e) => onEditGroup(wi, di, item.id, g.id, { count: Number(e.target.value) })} className="w-full bg-transparent text-center" />
                                )}
                              </div>
                              <div className="text-center">
                                {readOnly ? g.reps : (
                                  <input type="number" value={g.reps} onChange={(e) => onEditGroup(wi, di, item.id, g.id, { reps: Number(e.target.value) })} className="w-full bg-transparent text-center" />
                                )}
                              </div>
                              <div className="text-center">
                                {readOnly ? g.rpe : (
                                  <input type="number" step="0.5" value={g.rpe} onChange={(e) => onEditGroup(wi, di, item.id, g.id, { rpe: Number(e.target.value) })} className="w-full bg-transparent text-center" />
                                )}
                              </div>
                            </div>
                            <div className="mt-0.5 flex items-start justify-between gap-2 font-mono text-[10px] text-zinc-400">
                              <span>{kg}{item.kind === 'main' ? ' kg' : ''}</span>
                              {(g.floor || g.cap) && (
                                <span className="flex flex-col items-end leading-tight text-zinc-500">
                                  {g.floor ? <span>fl {g.floor}</span> : null}
                                  {g.cap ? <span>cap {g.cap}</span> : null}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      }))}
                      {dayItems(d).length === 0 && <div className="px-1 py-2 text-[11px] text-zinc-600">Empty</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
