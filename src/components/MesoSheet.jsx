import { fmtKg, loadFromChart, RANK_LABEL, WEEKDAYS, dayItems, dayTitle } from '../domain'

export function MesoSheet({ plan, client, selectedBlock, blockStart, totalWeeks, readOnly, onPickDay, onEditGroup, overrides }) {
  return (
    <div className="overflow-auto">
      <div className="flex min-w-max">
        {plan.weeks.map((wk, wi) => (
          <div key={wi} className="w-[320px] shrink-0 border-r border-white/8">
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#151821] px-3 py-2">
              <div className="font-display text-lg text-white">Week {wi + 1}</div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                {client.planningMode === 'meet' ? `${totalWeeks - (blockStart + wi)}w out` : `Block wk ${wi + 1}`}
              </div>
            </div>
            {wk.days.map((d, di) => {
              const override = overrides?.find((o) => o.blockId === selectedBlock.id && o.weekIndex === wi && o.dayIndex === di)
              return (
                <div key={d.id} className={`border-b border-white/8 ${d.active ? '' : 'opacity-45'}`}>
                  <button type="button" onClick={() => onPickDay?.(wi, di)} className="flex w-full items-center justify-between bg-white/4 px-3 py-1.5 text-left">
                    <span className="text-[11px] uppercase tracking-widest text-zinc-400">{WEEKDAYS[di].slice(0, 3)}</span>
                    <span className="text-[11px] text-violet-200">{dayTitle(d)}</span>
                  </button>
                  {override && (
                    <div className="bg-amber-400/15 px-3 py-1 text-[10px] uppercase tracking-wider text-amber-200">
                      Done {override.actualWeekday} (prescribed {override.prescribedWeekday})
                    </div>
                  )}
                  {!d.active ? (
                    <div className="px-3 py-2 text-[11px] text-zinc-600">Rest</div>
                  ) : (
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-[9px] uppercase tracking-wider text-zinc-600">
                          <th className="px-2 py-1 text-left">Set</th>
                          <th>n</th><th>reps</th><th>RPE</th><th>kg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayItems(d).flatMap((item) => item.setGroups.map((g) => (
                          <tr key={g.id} className={item.kind === 'accessory' ? 'bg-white/4 text-zinc-400' : item.lift === 'squat' ? 'bg-violet-600/25' : item.lift === 'bench' ? 'bg-indigo-600/20' : 'bg-fuchsia-700/20'}>
                            <td className="px-2 py-1">{item.kind === 'main' ? `${RANK_LABEL[item.rank]} ${g.exercise}` : item.name} · {g.label}</td>
                            <td className="px-1">
                              {readOnly ? g.count : <input type="number" value={g.count} onChange={(e) => onEditGroup(wi, di, item.id, g.id, { count: Number(e.target.value) })} className="w-8 bg-transparent text-center" />}
                            </td>
                            <td className="px-1">
                              {readOnly ? g.reps : <input type="number" value={g.reps} onChange={(e) => onEditGroup(wi, di, item.id, g.id, { reps: Number(e.target.value) })} className="w-8 bg-transparent text-center" />}
                            </td>
                            <td className="px-1">
                              {readOnly ? g.rpe : <input type="number" step="0.5" value={g.rpe} onChange={(e) => onEditGroup(wi, di, item.id, g.id, { rpe: Number(e.target.value) })} className="w-10 bg-transparent text-center" />}
                            </td>
                            <td className="px-1 font-mono">{item.kind === 'main' ? fmtKg(loadFromChart(client.pbs[item.lift], g.reps, g.rpe, g.modifier)) : g.cap || '—'}</td>
                          </tr>
                        )))}
                        {dayItems(d).length === 0 && <tr><td colSpan={5} className="px-2 py-2 text-zinc-600">Empty</td></tr>}
                      </tbody>
                    </table>
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
