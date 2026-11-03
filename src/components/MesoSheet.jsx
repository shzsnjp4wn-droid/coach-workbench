import { fmtKg, loadRangeFromChart, RANK_LABEL, WEEKDAYS, dayItems, dayTitle } from '../domain'
import { Stepper } from './ui'

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
        {weeks.map(({ wk, wi }) => {
          const isPrimary = wi === 0 || wi === selectedWeekIndex
          return (
            <div
              key={wi}
              className={`shrink-0 border-r border-white/10 transition ${focusWeekOnly ? 'w-full min-w-0' : 'w-[320px]'} ${isPrimary ? '' : 'opacity-45'}`}
            >
              <div className={`sticky top-0 z-10 border-b border-white/10 px-3 py-2.5 ${wi === 0 ? 'bg-[#152018]' : 'bg-[#12151d]'}`}>
                <div className="font-display text-xl tracking-wide text-white">
                  Week {wi + 1}
                  {wi === 0 && <span className="ml-2 text-[10px] uppercase tracking-widest text-lime-300/80">Main</span>}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                  {client.planningMode === 'meet' ? `${totalWeeks - (blockStart + wi)}w out` : `Block wk ${wi + 1}`}
                </div>
              </div>
              {wk.days.map((d, di) => {
                const override = overrides?.find((o) => o.blockId === selectedBlock.id && o.weekIndex === wi && o.dayIndex === di)
                const selected = selectedWeekIndex === wi && selectedDayIndex === di
                const items = dayItems(d)
                return (
                  <div
                    key={d.id}
                    className={`border-b border-white/10 transition ${d.active ? '' : 'opacity-45'} ${selected ? 'ring-2 ring-inset ring-lime-400/70' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => onPickDay?.(wi, di)}
                      className="flex w-full items-center justify-between bg-[#1a2a22] px-3 py-2 text-left hover:bg-[#1e3228]"
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-200">
                        {WEEKDAYS[di]}
                      </span>
                      <span className="truncate pl-2 text-[11px] text-violet-200">{dayTitle(d)}</span>
                    </button>
                    {override && (
                      <div className="bg-amber-400/15 px-3 py-1 text-[10px] uppercase tracking-wider text-amber-200">
                        Done {override.actualWeekday} (prescribed {override.prescribedWeekday})
                      </div>
                    )}
                    {!d.active ? (
                      <div className="px-3 py-3 text-xs text-zinc-600">Rest</div>
                    ) : (
                      <div className="space-y-2 px-2 py-2">
                        <div className="grid grid-cols-[minmax(0,1.2fr)_0.7fr_0.55fr] gap-1 px-1 text-[8px] font-semibold uppercase tracking-wider text-zinc-500">
                          <span>Exercise</span>
                          <span>Range</span>
                          <span>Goal</span>
                        </div>
                        {items.flatMap((item) => item.setGroups.map((g) => {
                          const range = item.kind === 'main'
                            ? loadRangeFromChart(client.pbs[item.lift], g.reps, g.rpe, g.modifier)
                            : null
                          const goal = item.kind === 'main'
                            ? range.goal
                            : (g.cap || g.floor || null)
                          const tone = item.kind === 'accessory'
                            ? 'border-white/8 bg-white/[0.03]'
                            : item.lift === 'squat'
                              ? 'border-violet-400/25 bg-violet-600/20'
                              : item.lift === 'bench'
                                ? 'border-indigo-400/25 bg-indigo-600/15'
                                : 'border-fuchsia-400/25 bg-fuchsia-700/15'
                          return (
                            <div key={g.id} className={`rounded-lg border px-2 py-2 ${tone}`}>
                              <div className="grid grid-cols-[minmax(0,1.2fr)_0.7fr_0.55fr] items-start gap-1">
                                <div className="min-w-0">
                                  <div className="truncate text-[12px] font-medium text-zinc-100">
                                    {item.kind === 'main' ? `${RANK_LABEL[item.rank]} ${g.exercise}` : item.name}
                                  </div>
                                  <div className="truncate text-[10px] text-zinc-500">{g.label}</div>
                                </div>
                                <div className="font-mono text-[11px] text-zinc-300">
                                  {range ? `${fmtKg(range.low)}–${fmtKg(range.high)}` : '—'}
                                </div>
                                <div className="font-mono text-[12px] text-white">
                                  {goal != null ? fmtKg(goal) : '—'}
                                </div>
                              </div>
                              {readOnly ? (
                                <div className="mt-2 flex gap-3 font-mono text-xs text-zinc-300">
                                  <span>{g.count}×</span>
                                  <span>{g.reps}r</span>
                                  <span>@{g.rpe}</span>
                                </div>
                              ) : (
                                <div className="mt-2 grid grid-cols-3 gap-1.5">
                                  <div>
                                    <div className="mb-1 text-center text-[8px] font-semibold uppercase tracking-wider text-zinc-500">Sets</div>
                                    <Stepper
                                      value={g.count}
                                      min={1}
                                      max={20}
                                      size="lg"
                                      onChange={(count) => onEditGroup(wi, di, item.id, g.id, { count })}
                                    />
                                  </div>
                                  <div>
                                    <div className="mb-1 text-center text-[8px] font-semibold uppercase tracking-wider text-zinc-500">Reps</div>
                                    <Stepper
                                      value={g.reps}
                                      min={1}
                                      max={30}
                                      size="lg"
                                      onChange={(reps) => onEditGroup(wi, di, item.id, g.id, { reps })}
                                    />
                                  </div>
                                  <div>
                                    <div className="mb-1 text-center text-[8px] font-semibold uppercase tracking-wider text-zinc-500">RPE</div>
                                    <Stepper
                                      value={g.rpe}
                                      step={0.5}
                                      min={5}
                                      max={10}
                                      size="lg"
                                      onChange={(rpe) => onEditGroup(wi, di, item.id, g.id, { rpe })}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        }))}
                        {items.length === 0 && (
                          <div className="px-2 py-3 text-xs text-zinc-600">Empty day — click to program</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
