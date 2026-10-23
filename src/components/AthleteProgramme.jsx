import { useState } from 'react'
import { ChevronLeft, Eye } from 'lucide-react'
import { BLOCK_PALETTE, WEEK_CELL_PX, WEEKDAYS, dayTitle, formatMeetDate, todayISO } from '../domain'
import { MesoSheet } from './MesoSheet'
import { Card, useCountdown } from './ui'

export function AthleteProgramme({
  client,
  blocks,
  weeks,
  plan,
  selectedBlock,
  selectedBlockId,
  blockStart,
  onSelectBlock,
  onOpenDay,
  onStartDate,
  selectedWeek = 0,
  selectedDay = 0,
  onSelectWeek,
  onSelectDay,
}) {
  const [view, setView] = useState('block') // block | week | day
  const countdown = useCountdown(client.meetDate, client.planningMode === 'meet')
  const timeline = []
  let cursor = 1
  blocks.forEach((block, blockIndex) => {
    for (let i = 0; i < block.weeks; i += 1) {
      timeline.push({ week: cursor, block, blockIndex, weekInBlock: i })
      cursor += 1
    }
  })

  function pickBlock(id) {
    onSelectBlock(id)
    setView('block')
  }

  function pickWeek(blockId, weekInBlock) {
    onSelectBlock(blockId)
    onSelectWeek?.(weekInBlock)
    setView('week')
  }

  function pickDay(weekIndex, dayIndex) {
    onSelectWeek?.(weekIndex)
    onSelectDay?.(dayIndex)
    setView('day')
  }

  return (
    <div className="grid gap-4">
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm text-zinc-300">Whole programme · {client.name}</div>
            <h1 className="font-display text-3xl text-white">{client.event}</h1>
            <p className="text-xs text-zinc-500">
              {client.planningMode === 'meet' ? `Meet ${formatMeetDate(client.meetDate)}` : `${client.blockWeeks} week block`}
              {' · '}starts {formatMeetDate(client.startDate)}
              {' · '}today {formatMeetDate(todayISO())}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">Programme start</div>
              <input type="date" value={client.startDate} onChange={(e) => onStartDate(e.target.value)} className="rounded-md border border-white/10 bg-[#151821] px-2 py-1" />
            </label>
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
        <div className="overflow-x-auto">
          <div style={{ width: weeks * WEEK_CELL_PX, minWidth: weeks * WEEK_CELL_PX }}>
            <div className="mb-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${weeks}, ${WEEK_CELL_PX}px)` }}>
              {blocks.map((block, i) => (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => pickBlock(block.id)}
                  style={{ gridColumn: `span ${block.weeks}` }}
                  className={`rounded-lg border px-3 py-2 text-left transition ${BLOCK_PALETTE[i % 4].surface} ${selectedBlockId === block.id ? 'ring-2 ring-lime-400' : 'hover:ring-1 hover:ring-white/30'}`}
                >
                  <div className="text-sm font-medium">{block.name}</div>
                  <div className="text-[11px] text-zinc-400">{block.weeks} wk{client.plans[block.id] ? '' : ' · not published'}</div>
                </button>
              ))}
            </div>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${weeks}, ${WEEK_CELL_PX}px)` }}>
              {timeline.map((cell) => {
                const selected = selectedBlockId === cell.block.id && selectedWeek === cell.weekInBlock && (view === 'week' || view === 'day')
                return (
                  <button
                    key={cell.week}
                    type="button"
                    onClick={() => pickWeek(cell.block.id, cell.weekInBlock)}
                    className={`rounded-lg border bg-[#10131a] px-1.5 py-2 text-left transition ${BLOCK_PALETTE[cell.blockIndex % 4].chip} ${selected ? 'ring-2 ring-lime-400' : 'hover:ring-1 hover:ring-white/30'}`}
                  >
                    <div className="font-display text-sm text-white">Wk {cell.week}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      {plan && selectedBlock ? (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/8 px-4 py-3 text-sm text-zinc-300">
            <Eye size={16} className="text-lime-300" />
            <button type="button" onClick={() => setView('block')} className={`hover:text-white ${view === 'block' ? 'text-white' : ''}`}>
              {selectedBlock.name}
            </button>
            {(view === 'week' || view === 'day') && (
              <>
                <span className="text-zinc-600">/</span>
                <button type="button" onClick={() => setView('week')} className={`hover:text-white ${view === 'week' ? 'text-white' : ''}`}>
                  Week {selectedWeek + 1}
                </button>
              </>
            )}
            {view === 'day' && (
              <>
                <span className="text-zinc-600">/</span>
                <span className="text-white">{WEEKDAYS[selectedDay]}</span>
              </>
            )}
            <span className="text-zinc-500">· read only</span>
            {view !== 'block' && (
              <button
                type="button"
                onClick={() => setView(view === 'day' ? 'week' : 'block')}
                className="ml-auto inline-flex items-center gap-1 text-xs text-lime-300"
              >
                <ChevronLeft size={12} /> Back to {view === 'day' ? 'week' : 'block'}
              </button>
            )}
            {view === 'day' && (
              <button
                type="button"
                onClick={() => onOpenDay(selectedWeek, selectedDay)}
                className="rounded-md bg-lime-400 px-2 py-1 text-xs font-semibold text-black"
              >
                Open to log
              </button>
            )}
          </div>

          {view === 'day' && plan.weeks[selectedWeek] && (
            <div className="border-b border-white/8 px-4 py-3">
              <div className="mb-2 flex flex-wrap gap-1">
                {plan.weeks[selectedWeek].days.map((d, di) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => pickDay(selectedWeek, di)}
                    className={`rounded-lg border px-2 py-1.5 text-left transition ${di === selectedDay ? 'border-lime-400/70 bg-lime-400/10' : 'border-white/10 hover:border-white/30'} ${d.active ? '' : 'opacity-50'}`}
                  >
                    <div className="text-[10px] uppercase tracking-wider text-zinc-400">{WEEKDAYS[di].slice(0, 3)}</div>
                    <div className="text-[11px] text-zinc-200">{dayTitle(d)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <MesoSheet
            plan={plan}
            client={client}
            selectedBlock={selectedBlock}
            blockStart={blockStart}
            totalWeeks={weeks}
            readOnly
            overrides={client.scheduleOverrides}
            selectedWeekIndex={view === 'block' ? null : selectedWeek}
            selectedDayIndex={view === 'day' ? selectedDay : null}
            focusWeekOnly={view === 'week' || view === 'day'}
            onPickDay={(wi, di) => {
              pickDay(wi, di)
            }}
            onEditGroup={() => {}}
          />
        </Card>
      ) : (
        <Card className="p-4 text-sm text-zinc-500">This block has no sessions yet.</Card>
      )}
    </div>
  )
}
