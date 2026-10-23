import { Eye } from 'lucide-react'
import { BLOCK_PALETTE, WEEK_CELL_PX, formatMeetDate } from '../domain'
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
}) {
  const countdown = useCountdown(client.meetDate, client.planningMode === 'meet')
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
            <div className="text-sm text-zinc-300">Whole programme · {client.name}</div>
            <h1 className="font-display text-3xl text-white">{client.event}</h1>
            <p className="text-xs text-zinc-500">
              {client.planningMode === 'meet' ? `Meet ${formatMeetDate(client.meetDate)}` : `${client.blockWeeks} week block`}
              {' · '}starts {formatMeetDate(client.startDate)}
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
                <button key={block.id} type="button" onClick={() => onSelectBlock(block.id)} style={{ gridColumn: `span ${block.weeks}` }} className={`rounded-lg border px-3 py-2 text-left ${BLOCK_PALETTE[i % 4].surface} ${selectedBlockId === block.id ? 'ring-2 ring-lime-400' : ''}`}>
                  <div className="text-sm font-medium">{block.name}</div>
                  <div className="text-[11px] text-zinc-400">{block.weeks} wk{client.plans[block.id] ? '' : ' · not published'}</div>
                </button>
              ))}
            </div>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${weeks}, ${WEEK_CELL_PX}px)` }}>
              {timeline.map((cell) => (
                <div key={cell.week} className={`rounded-lg border bg-[#10131a] px-1.5 py-2 ${BLOCK_PALETTE[cell.blockIndex % 4].chip}`}>
                  <div className="font-display text-sm text-white">Wk {cell.week}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {plan && selectedBlock ? (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3 text-sm text-zinc-300">
            <Eye size={16} className="text-lime-300" /> {selectedBlock.name} · read only. Open a day to log it.
          </div>
          <MesoSheet
            plan={plan}
            client={client}
            selectedBlock={selectedBlock}
            blockStart={blockStart}
            totalWeeks={weeks}
            readOnly
            overrides={client.scheduleOverrides}
            onPickDay={onOpenDay}
            onEditGroup={() => {}}
          />
        </Card>
      ) : (
        <Card className="p-4 text-sm text-zinc-500">This block has no sessions yet.</Card>
      )}
    </div>
  )
}
