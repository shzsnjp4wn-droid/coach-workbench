import { useMemo, useState } from 'react'
import { Copy, Dumbbell, Search, Zap } from 'lucide-react'
import { fmtKg, latestEstimates, matchesUserQuery } from '../domain'
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

/** Create a profile (name → auto code) or find an existing one by name / ATH- / CH- code. */
export function ProfileGate({
  role,
  coaches,
  athletes,
  onBack,
  onCreate,
  onSelect,
}) {
  const [name, setName] = useState('')
  const [sex, setSex] = useState('male')
  const [bodyweightKg, setBodyweightKg] = useState('83')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const accent = role === 'coach' ? 'cyan' : 'lime'

  const directory = useMemo(() => {
    if (role === 'coach') {
      return coaches.map((c) => ({ ...c, kind: 'coach' }))
    }
    return Object.values(athletes).map((a) => ({ ...a, kind: 'athlete' }))
  }, [role, coaches, athletes])

  const hits = useMemo(
    () => directory.filter((p) => matchesUserQuery(p, query)).slice(0, 40),
    [directory, query],
  )

  async function submitCreate(e) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      await onCreate({
        name: name.trim(),
        sex,
        bodyweightKg: Number(bodyweightKg) || undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-svh bg-[#07080b] px-4 py-6 text-zinc-200">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${role === 'coach' ? 'bg-cyan-400' : 'bg-lime-400'} text-black`}><Zap size={18} /></div>
            <div>
              <div className="font-display text-2xl tracking-[0.14em] text-white">IRON//WORKBENCH</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{role === 'coach' ? 'Coach profile' : 'Athlete profile'}</div>
            </div>
          </div>
          <button type="button" onClick={onBack} className="text-xs uppercase tracking-wider text-zinc-500">Change role</button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <div className={`text-[10px] uppercase tracking-[0.16em] ${role === 'coach' ? 'text-cyan-300' : 'text-lime-300'}`}>New profile</div>
            <h1 className="mt-2 font-display text-4xl text-white">What’s your name?</h1>
            <p className="mt-2 text-sm text-zinc-500">
              We’ll create your account and generate a unique code
              ({role === 'coach' ? 'CH-…' : 'ATH-…'}) you can share.
            </p>
            <form className="mt-5 grid gap-3" onSubmit={submitCreate}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={role === 'coach' ? 'Sam Okonkwo' : 'David Thomas'}
                className="rounded-lg border border-white/10 bg-[#151821] px-3 py-3 text-lg"
                autoFocus
              />
              {role === 'athlete' && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1 text-xs">
                    <span className="uppercase tracking-widest text-zinc-500">Sex</span>
                    <select value={sex} onChange={(e) => setSex(e.target.value)} className="rounded-lg border border-white/10 bg-[#151821] px-3 py-2 text-sm">
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs">
                    <span className="uppercase tracking-widest text-zinc-500">Bodyweight (kg)</span>
                    <input
                      type="number"
                      step="0.1"
                      min="30"
                      value={bodyweightKg}
                      onChange={(e) => setBodyweightKg(e.target.value)}
                      className="rounded-lg border border-white/10 bg-[#151821] px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              )}
              <button
                type="submit"
                disabled={!name.trim() || busy}
                className={`rounded-lg px-4 py-3 text-sm font-semibold text-black disabled:opacity-50 ${role === 'coach' ? 'bg-cyan-400' : 'bg-lime-400'}`}
              >
                {busy ? 'Creating…' : `Create ${role} profile`}
              </button>
            </form>
          </Card>

          <Card className="p-5">
            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Find an account</div>
            <h2 className="mt-2 font-display text-3xl text-white">Search the directory</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Search by name or unique code (CH-… / ATH-…). Names can repeat; codes cannot.
            </p>
            <div className="relative mt-4">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={role === 'coach' ? 'Name or CH-…' : 'Name or ATH-…'}
                className="w-full rounded-lg border border-white/10 bg-[#151821] py-2.5 pl-9 pr-3 font-mono text-sm"
              />
            </div>
            <div className="mt-3 max-h-[360px] space-y-2 overflow-auto">
              {!hits.length && (
                <div className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-sm text-zinc-500">
                  {query.trim() ? 'No matches in the directory.' : 'Type to search everyone in the database.'}
                </div>
              )}
              {hits.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => onSelect(person)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left hover:bg-white/4 ${accent === 'cyan' ? 'border-white/8' : 'border-white/8'}`}
                >
                  <Avatar id={person.id} name={person.name} className="h-10 w-10 text-sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-white">{person.name}</div>
                    <div className="font-mono text-xs tracking-wider text-zinc-500">{person.code}</div>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">Open</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function ConnectGate({
  role,
  athletes,
  coaches,
  coach,
  selfAthlete,
  onConnectCoach,
  onDisconnect,
  onOpen,
  onBack,
  onCopy,
  onSearchConnect,
}) {
  const [query, setQuery] = useState('')
  const [transferHistory, setTransferHistory] = useState(true)
  const list = Object.values(athletes)
  const connected = list.filter((a) => a.coachId === coach?.id)
  const directoryHits = useMemo(() => {
    const q = query.trim()
    if (!q) return []
    const people = [
      ...coaches.map((c) => ({ ...c, kind: 'coach' })),
      ...list.map((a) => ({ ...a, kind: 'athlete' })),
    ]
    return people.filter((p) => matchesUserQuery(p, q)).slice(0, 30)
  }, [query, coaches, list])

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
          <button type="button" onClick={onBack} className="text-xs uppercase tracking-wider text-zinc-500">Switch profile</button>
        </div>

        {role === 'coach' && coach ? (
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
                <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Find anyone</div>
                <p className="mt-1 text-xs text-zinc-500">Search by name or code (ATH-… / CH-…).</p>
                <div className="relative mt-2">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Name or ATH-…"
                    className="w-full rounded-lg border border-white/10 bg-[#151821] py-2 pl-9 pr-3 font-mono text-sm"
                  />
                </div>
                {query.trim() && (
                  <div className="mt-3 max-h-56 space-y-1 overflow-auto">
                    {!directoryHits.length && <div className="px-2 py-3 text-sm text-zinc-500">No users match.</div>}
                    {directoryHits.map((person) => (
                      <div key={`${person.kind}-${person.id}`} className="flex items-center gap-2 rounded-lg border border-white/8 px-2 py-2">
                        <Avatar id={person.id} name={person.name} className="h-8 w-8 text-xs" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-white">{person.name}</div>
                          <div className="font-mono text-[11px] text-zinc-500">{person.code} · {person.kind}</div>
                        </div>
                        {person.kind === 'athlete' ? (
                          <button
                            type="button"
                            onClick={() => onSearchConnect(person)}
                            className="rounded-md bg-cyan-400 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-black"
                          >
                            {person.coachId === coach.id ? 'Open' : 'Connect'}
                          </button>
                        ) : (
                          <span className="text-[10px] uppercase text-zinc-600">Coach</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              <Roster title="On your floor" people={connected} action="Open" onAction={onOpen} />
            </div>
          </div>
        ) : selfAthlete ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card className="p-5">
              <div className="flex items-center gap-2 text-lime-300"><Dumbbell size={16} /> {selfAthlete.name}</div>
              <div className="mt-3 font-mono text-2xl tracking-widest text-lime-200">{selfAthlete.code}</div>
              <p className="mt-2 text-sm text-zinc-500">Share this code with your coach. Search below for a coach by name or CH- code.</p>
              <button type="button" onClick={() => onCopy(selfAthlete.code)} className="mt-3 inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-xs uppercase tracking-wider text-zinc-400">
                <Copy size={12} /> Copy my code
              </button>
              <div className="relative mt-5">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name or CH-…"
                  className="w-full rounded-lg border border-white/10 bg-[#151821] py-2.5 pl-9 pr-3 font-mono text-sm"
                />
              </div>
              {query.trim() && (
                <div className="mt-3 max-h-64 space-y-1 overflow-auto">
                  {!directoryHits.length && <div className="px-2 py-3 text-sm text-zinc-500">No users match.</div>}
                  {directoryHits.map((person) => (
                    <div key={`${person.kind}-${person.id}`} className="flex items-center gap-2 rounded-lg border border-white/8 px-2 py-2">
                      <Avatar id={person.id} name={person.name} className="h-8 w-8 text-xs" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-white">{person.name}</div>
                        <div className="font-mono text-[11px] text-zinc-500">{person.code} · {person.kind}</div>
                      </div>
                      {person.kind === 'coach' ? (
                        <button
                          type="button"
                          disabled={Boolean(selfAthlete.coachId)}
                          onClick={() => onConnectCoach(person.id, { transferHistory })}
                          className="rounded-md bg-lime-400 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-black disabled:opacity-40"
                        >
                          Connect
                        </button>
                      ) : person.id === selfAthlete.id ? (
                        <span className="text-[10px] uppercase text-zinc-600">You</span>
                      ) : (
                        <span className="text-[10px] uppercase text-zinc-600">Athlete</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card className="p-4">
              {selfAthlete.coachId ? (
                <>
                  <p className="text-sm text-zinc-400">
                    Connected to {coaches.find((c) => c.id === selfAthlete.coachId)?.name || 'your coach'}.
                  </p>
                  <button type="button" onClick={() => onOpen(selfAthlete.id)} className="mt-4 w-full rounded-lg bg-lime-400 py-2 text-sm font-semibold text-black">Open programme</button>
                  <button
                    type="button"
                    onClick={() => onDisconnect?.()}
                    className="mt-2 w-full rounded-lg border border-orange-400/40 py-2 text-sm text-orange-200"
                  >
                    Disconnect from current coach
                  </button>
                  <p className="mt-2 text-[11px] text-zinc-500">You must disconnect before connecting to a different coach.</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-zinc-400">No coach yet. Find them by name or CH- code below.</p>
                  <label className="mt-3 flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-300">
                    <input type="checkbox" checked={transferHistory} onChange={(e) => setTransferHistory(e.target.checked)} className="mt-0.5" />
                    <span>Transfer past programme blocks, logs, and PB history to the new coach</span>
                  </label>
                </>
              )}
              {selfAthlete.coachId && (
                <div className="mt-4 text-xs text-zinc-500">
                  Est. · S {fmtKg(latestEstimates(selfAthlete).squat)} · B {fmtKg(latestEstimates(selfAthlete).bench)} · D {fmtKg(latestEstimates(selfAthlete).deadlift)}
                </div>
              )}
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Roster({ title, people, action, onAction }) {
  if (!people.length) {
    return (
      <Card className="p-4">
        <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">{title}</div>
        <p className="text-sm text-zinc-500">Nobody here yet — search ATH- codes above to connect athletes.</p>
      </Card>
    )
  }
  return (
    <Card className="p-4">
      <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">{title}</div>
      <div className="grid gap-2">
        {people.map((person) => (
          <div key={person.id} className="flex items-center gap-3 rounded-lg border border-white/8 px-3 py-2">
            <Avatar id={person.id} name={person.name} className="h-10 w-10 text-sm" />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white">{person.name}</div>
              <div className="text-xs text-zinc-500">{person.event || 'Athlete'} · <span className="font-mono">{person.code}</span></div>
            </div>
            <button type="button" onClick={() => onAction(person.id)} className="rounded-md bg-white/10 px-3 py-1.5 text-xs uppercase tracking-wider text-white">{action}</button>
          </div>
        ))}
      </div>
    </Card>
  )
}
