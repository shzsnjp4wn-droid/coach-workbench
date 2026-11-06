import {
  chartReps,
  fmtKg,
  formatPrescription,
  formatReps,
  hasRepRange,
  loadRangeFromChart,
  RANK_LABEL,
  WEEKDAYS,
  dayItems,
  dayTitle,
} from '../domain'
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
        {weeks.map(({ wk, wi }) => (
          <div
            key={wi}
            className={`shrink-0 border-r border-white/10 ${focusWeekOnly ? 'w-full min-w-0' : 'w-[min(320px,85vw)]'}`}
          >
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#12151d] px-3 py-2.5">
              <div className="font-display text-xl tracking-wide text-white">Week {wi + 1}</div>
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
                      <div className="grid grid-cols-[minmax(0,1.1fr)_0.75fr_0.6fr] gap-1 px-1 text-[8px] font-semibold uppercase tracking-wider text-zinc-500">
                        <span>Exercise</span>
                        <span>Range</span>
                        <span>Goal</span>
                      </div>
                      {items.flatMap((item) => item.setGroups.map((g) => {
                        const chartR = chartReps(g)
                        const range = item.kind === 'main'
                          ? loadRangeFromChart(client.pbs[item.lift], chartR, g.rpe, g.modifier, {
                            floor: g.floor,
                            cap: g.cap,
                          })
                          : null
                        const goalValue = g.goalKg !== '' && g.goalKg != null
                          ? Number(g.goalKg)
                          : (range?.goal ?? (g.cap || g.floor || null))
                        const tone = item.kind === 'accessory'
                          ? 'border-white/8 bg-white/[0.03]'
                          : item.lift === 'squat'
                            ? 'border-violet-400/25 bg-violet-600/20'
                            : item.lift === 'bench'
                              ? 'border-indigo-400/25 bg-indigo-600/15'
                              : 'border-fuchsia-400/25 bg-fuchsia-700/15'
                        const rangeMode = hasRepRange(g)
                        return (
                          <div key={g.id} className={`rounded-lg border px-2 py-2 ${tone}`}>
                            <div className="grid grid-cols-[minmax(0,1.1fr)_0.75fr_0.6fr] items-start gap-1">
                              <div className="min-w-0">
                                <div className="truncate text-[12px] font-medium text-zinc-100">
                                  {item.kind === 'main' ? `${RANK_LABEL[item.rank]} ${g.exercise}` : item.name}
                                </div>
                                {(g.label || '').trim() ? (
                                  <div className="truncate text-[10px] text-zinc-500">{g.label}</div>
                                ) : null}
                                {/* Read-only: one prescription line. Edit mode uses steppers only — no duplicate text. */}
                                {readOnly && (
                                  <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-200">
                                    {formatPrescription(g)}
                                  </div>
                                )}
                              </div>
                              <div className="font-mono text-[11px] text-zinc-300">
                                {range ? `${fmtKg(range.low)}–${fmtKg(range.high)}` : '—'}
                              </div>
                              <div>
                                {readOnly || item.kind !== 'main' ? (
                                  <div className="font-mono text-[12px] text-white">
                                    {goalValue != null && goalValue !== '' ? fmtKg(goalValue) : '—'}
                                  </div>
                                ) : (
                                  <input
                                    type="number"
                                    step="2.5"
                                    value={g.goalKg !== '' && g.goalKg != null ? g.goalKg : (range?.goal ?? '')}
                                    onChange={(e) => onEditGroup(wi, di, item.id, g.id, { goalKg: e.target.value })}
                                    className="w-full rounded border border-white/15 bg-black/30 px-1 py-0.5 font-mono text-[12px] text-white outline-none"
                                    title="Goal weight (kg)"
                                  />
                                )}
                              </div>
                            </div>
                            {readOnly ? null : (
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
                                  <div className="mb-1 text-center text-[8px] font-semibold uppercase tracking-wider text-zinc-500">
                                    Reps{rangeMode ? ` ${formatReps(g)}` : ''}
                                  </div>
                                  {rangeMode ? (
                                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-0.5">
                                      <Stepper
                                        value={g.reps}
                                        min={1}
                                        max={29}
                                        size="lg"
                                        onChange={(reps) => {
                                          const high = Number(g.repsMax)
                                          onEditGroup(wi, di, item.id, g.id, {
                                            reps,
                                            repsMax: Number.isFinite(high) && high <= reps ? reps + 1 : g.repsMax,
                                          })
                                        }}
                                      />
                                      <span className="text-[10px] text-zinc-500">–</span>
                                      <Stepper
                                        value={g.repsMax}
                                        min={(Number(g.reps) || 1) + 1}
                                        max={30}
                                        size="lg"
                                        onChange={(repsMax) => onEditGroup(wi, di, item.id, g.id, { repsMax })}
                                      />
                                    </div>
                                  ) : (
                                    <Stepper
                                      value={g.reps}
                                      min={1}
                                      max={30}
                                      size="lg"
                                      onChange={(reps) => onEditGroup(wi, di, item.id, g.id, { reps })}
                                    />
                                  )}
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
        ))}
      </div>
    </div>
  )
}
