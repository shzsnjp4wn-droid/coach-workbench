import { useState } from 'react'
import { Copy, Dumbbell, Zap } from 'lucide-react'
import { COACH, fmtKg, latestEstimates } from '../domain'
import { Avatar, Card } from './ui'

export function RoleGate({ onChoose }) {
  return (
    <div className="min-h-svh bg-[#07080b] px-4 py-8 text-zinc-200">
      <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-5xl flex-col">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400 text-black"><Zap size={18} /></div>
          <div className="font-display text-2xl tracking-[0.14em] text-white">IRON//WORKBENCH</div>
        </div>
        <div className="my-auto grid gap-6 py-10">
          <div>
            <h1 className="font-display text-6xl leading-none text-white">Who’s opening the floor?</h1>
            <p className="mt-3 max-w-xl text-sm text-zinc-400">Coaches write the block. Athletes train the day, log every set, and send the clip with the load on it.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <button type="button" onClick={() => onChoose('coach')} className="rounded-2xl border border-cyan-400/30 bg-cyan-400/8 p-6 text-left hover:bg-cyan-400/14">
              <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">Coach</div>
              <div className="mt-2 font-display text-4xl text-white">Programme</div>
              <p className="mt-2 text-sm text-zinc-400">Connect athletes, write the weeks, watch e1RMs move, and review every set they film.</p>
            </button>
            <button type="button" onClick={() => onChoose('athlete')} className="rounded-2xl border border-lime-400/30 bg-lime-400/8 p-6 text-left hover:bg-lime-400/14">
              <div className="text-[10px] uppercase tracking-[0.2em] text-lime-300">Athlete</div>
              <div className="mt-2 font-display text-4xl text-white">Train</div>
              <p className="mt-2 text-sm text-zinc-400">Connect to your coach, see the whole block, and log the day’s sets with a clip.</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ConnectGate({ role, athletes, coach = COACH, initialAthleteId, onConnect, onOpen, onCode, onBack, onCopy }) {
  const list = Object.values(athletes)
  const [selfId, setSelfId] = useState(initialAthleteId || list[0]?.id || '')
  const [code, setCode] = useState('')
  const self = athletes[selfId] || list[0]
  const connected = list.filter((a) => a.coachId === coach.id)
  const openRoster = list.filter((a) => a.coachId !== coach.id)

  return (
    <div className="min-h-svh bg-[#07080b] px-4 py-6 text-zinc-200">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400 text-black"><Zap size={18} /></div>
            <div>
              <div className="font-display text-2xl tracking-[0.14em] text-white">IRON//WORKBENCH</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{role === 'coach' ? 'Coach' : 'Athlete'}</div>
            </div>
          </div>
          <button type="button" onClick={onBack} className="text-xs uppercase tracking-wider text-zinc-500">Change role</button>
        </div>

        {role === 'coach' ? (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <Card className="p-4">
              <Avatar id={coach.id} name={coach.name} className="h-14 w-14 text-lg" />
              <div className="mt-3 font-display text-3xl text-white">{coach.name}</div>
              <p className="text-sm text-zinc-500">Athletes connect with your code, then you open their programme.</p>
              <div className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500">Your code</div>
                  <div className="font-mono text-lg tracking-widest text-cyan-200">{coach.code}</div>
                </div>
                <button type="button" onClick={() => onCopy(coach.code)} className="rounded-md border border-white/10 p-2 text-zinc-400" aria-label="Copy code"><Copy size={14} /></button>
              </div>
            </Card>
            <div className="grid gap-4">
              <Card className="p-4">
                <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Connect with a code</div>
                <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); onCode(code); setCode('') }}>
                  <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ATH-OLA" className="w-full rounded-lg border border-white/10 bg-[#151821] px-3 py-2 font-mono tracking-widest" />
                  <button type="submit" className="rounded-lg bg-cyan-400 px-4 text-sm font-semibold text-black">Connect</button>
                </form>
              </Card>
              <Roster title="On your floor" people={connected} action="Open" onAction={onOpen} />
              <Roster title="Not connected" people={openRoster} action="Connect" onAction={(id) => onConnect(id, false)} />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="grid gap-3">
              <h1 className="font-display text-4xl text-white">Who’s lifting?</h1>
              {list.map((person) => {
                const est = latestEstimates(person)
                const active = selfId === person.id
                return (
                  <button key={person.id} type="button" onClick={() => setSelfId(person.id)} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${active ? 'border-lime-400/50 bg-lime-400/8' : 'border-white/8 bg-[#0e1016]'}`}>
                    <Avatar id={person.id} name={person.name} className="h-12 w-12 text-base" />
                    <div className="min-w-0 flex-1">
                      <div className="text-white">{person.name}</div>
                      <div className="text-xs text-zinc-500">{person.event} · {person.code}</div>
                    </div>
                    <div className="text-right font-mono text-xs text-zinc-400">
                      <div>S {fmtKg(est.squat)}</div>
                      <div>B {fmtKg(est.bench)} · D {fmtKg(est.deadlift)}</div>
                    </div>
                  </button>
                )
              })}
            </div>
            {self && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-lime-300"><Dumbbell size={16} /> {self.name}</div>
                {self.coachId ? (
                  <>
                    <p className="mt-3 text-sm text-zinc-400">Connected to {coach.name}. Their code is <span className="font-mono text-zinc-200">{coach.code}</span>.</p>
                    <button type="button" onClick={() => onOpen(self.id)} className="mt-4 w-full rounded-lg bg-lime-400 py-2 text-sm font-semibold text-black">Open programme</button>
                  </>
                ) : (
                  <>
                    <p className="mt-3 text-sm text-zinc-400">No coach yet. Connect with their code to open the programme.</p>
                    <button type="button" onClick={() => onConnect(self.id, true)} className="mt-3 w-full rounded-lg border border-white/10 py-2 text-sm">Connect to {coach.name}</button>
                    <form className="mt-3 grid gap-2" onSubmit={(e) => { e.preventDefault(); onCode(code, self.id) }}>
                      <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={coach.code} className="rounded-lg border border-white/10 bg-[#151821] px-3 py-2 font-mono tracking-widest" />
                      <button type="submit" className="rounded-lg bg-lime-400 py-2 text-sm font-semibold text-black">Connect with code</button>
                    </form>
                  </>
                )}
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Roster({ title, people, action, onAction }) {
  if (!people.length) return null
  return (
    <Card className="p-4">
      <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">{title}</div>
      <div className="grid gap-2">
        {people.map((person) => (
          <div key={person.id} className="flex items-center gap-3 rounded-lg border border-white/8 px-3 py-2">
            <Avatar id={person.id} name={person.name} className="h-10 w-10 text-sm" />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white">{person.name}</div>
              <div className="text-xs text-zinc-500">{person.event} · <span className="font-mono">{person.code}</span></div>
            </div>
            <button type="button" onClick={() => onAction(person.id)} className="rounded-md bg-white/10 px-3 py-1.5 text-xs uppercase tracking-wider text-white">{action}</button>
          </div>
        ))}
      </div>
    </Card>
  )
}
