import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Dumbbell, LayoutGrid, MessageCircle, TrendingUp, Video, Zap } from 'lucide-react'
import { AthleteProgramme } from './components/AthleteProgramme'
import { AthleteToday } from './components/AthleteToday'
import { CoachProgramme } from './components/CoachProgramme'
import { ConnectGate, RoleGate } from './components/Gates'
import { MessagesPage } from './components/MessagesPage'
import { ProgressPage } from './components/ProgressPage'
import { VideosPage } from './components/VideosPage'
import {
  COACH as FALLBACK_COACH,
  WEEKDAYS,
  e1FromSet,
  emptyPlan,
  findLog,
  fmtKg,
  normalizeBlocks,
  pushE1rm,
  runwayWeeks,
  sessionAt,
  setCaption,
  syncPlanLength,
  todayISO,
  uid,
  unreadCount,
} from './domain'
import {
  fetchWorkspace,
  formatSupabaseError,
  insertMessage,
  markMessagesRead,
  persistAthleteStructure,
  persistPlan,
  updateAthleteCoachId,
  uploadMedia,
  upsertE1rmPoint,
  upsertScheduleOverride,
  upsertSetLog,
  upsertVideo,
} from './supabaseClient'

const PERSIST_DEBOUNCE_MS = 50

export default function App() {
  const [boot, setBoot] = useState({ status: 'loading', error: null })
  const [coach, setCoach] = useState(FALLBACK_COACH)
  const [screen, setScreen] = useState('role')
  const [role, setRole] = useState(null)
  const [athleteId, setAthleteId] = useState(null)
  const [athletes, setAthletes] = useState({})
  const [messages, setMessages] = useState({})
  const [page, setPage] = useState('programme')
  const [selectedBlockId, setSelectedBlockId] = useState(null)
  const [selectedWeek, setSelectedWeek] = useState(0)
  const [selectedDay, setSelectedDay] = useState(0)
  const [stage, setStage] = useState('macro')
  const [toast, setToast] = useState('')
  const [saveState, setSaveState] = useState('idle')
  const persistTimers = useRef({})
  const persistFns = useRef({})
  const toastRef = useRef(setToast)
  toastRef.current = setToast

  function reportPersistError(key, err) {
    const message = err?.message || formatSupabaseError(err, key) || `Could not save ${key}`
    console.error(`[supabase] persist ${key} failed`, err)
    toastRef.current(message)
    setSaveState('error')
  }

  function schedulePersist(key, fn) {
    persistFns.current[key] = fn
    clearTimeout(persistTimers.current[key])
    persistTimers.current[key] = setTimeout(() => {
      const pending = persistFns.current[key]
      delete persistFns.current[key]
      delete persistTimers.current[key]
      if (!pending) return
      setSaveState('saving')
      pending()
        .then(() => setSaveState('saved'))
        .catch((err) => reportPersistError(key, err))
    }, PERSIST_DEBOUNCE_MS)
  }

  async function flushPersists() {
    const entries = Object.entries(persistFns.current)
    Object.values(persistTimers.current).forEach(clearTimeout)
    persistTimers.current = {}
    persistFns.current = {}
    if (!entries.length) return
    setSaveState('saving')
    const results = await Promise.allSettled(entries.map(([, fn]) => fn()))
    const failed = results.find((r) => r.status === 'rejected')
    if (failed) {
      reportPersistError('flush', failed.reason)
      return
    }
    setSaveState('saved')
  }

  const flushPersistsRef = useRef(flushPersists)
  flushPersistsRef.current = flushPersists

  useEffect(() => {
    const onLeave = () => {
      // Fire pending writes before the document unloads (refresh/close/tab hide).
      void flushPersistsRef.current()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onLeave()
    }
    window.addEventListener('pagehide', onLeave)
    window.addEventListener('beforeunload', onLeave)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onLeave)
      window.removeEventListener('beforeunload', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      void flushPersistsRef.current()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function bootFromSupabase() {
      setBoot({ status: 'loading', error: null })
      try {
        const workspace = await fetchWorkspace()
        if (cancelled) return
        if (!workspace.coaches.length) {
          throw new Error('No coaches found in Supabase. Run the seed script after schema setup.')
        }
        if (!Object.keys(workspace.athletes).length) {
          throw new Error('No athletes found in Supabase. Run npm run seed:supabase.')
        }
        // Use DB rows only — do not merge createWorkspace() / domain mock presets.
        const nextCoach = workspace.coaches.find((c) => c.id === FALLBACK_COACH.id) || workspace.coaches[0]
        setCoach(nextCoach)
        setAthletes(workspace.athletes)
        setMessages(workspace.messages)
        setBoot({ status: 'ready', error: null })
      } catch (err) {
        if (cancelled) return
        console.error('[supabase] workspace load failed', err)
        setBoot({
          status: 'error',
          error: err?.message || formatSupabaseError(err, 'workspace load') || 'Could not load workspace from Supabase.',
        })
      }
    }
    bootFromSupabase()
    return () => { cancelled = true }
  }, [])

  const athlete = athleteId ? athletes[athleteId] : null
  const weeks = athlete ? runwayWeeks(athlete) : 0
  const blocks = useMemo(
    () => (athlete ? normalizeBlocks(athlete.blocks, weeks) : []),
    [athlete, weeks],
  )
  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null
  const plan = selectedBlock && athlete ? athlete.plans[selectedBlock.id] : null
  const blockStart = selectedBlock
    ? blocks.slice(0, blocks.findIndex((b) => b.id === selectedBlock.id)).reduce((sum, b) => sum + b.weeks, 0)
    : 0

  useEffect(() => {
    if (!toast) return undefined
    const id = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(id)
  }, [toast])

  const connected = Object.values(athletes).filter((a) => a.coachId === coach.id)
  const messageBadge = role === 'coach'
    ? connected.reduce((sum, person) => sum + unreadCount(messages, person.id, 'coach'), 0)
    : (athlete ? unreadCount(messages, athlete.id, 'athlete') : 0)

  function patchAthlete(mutator) {
    setAthletes((prev) => {
      const current = prev[athleteId]
      if (!current) return prev
      const next = mutator({ ...current })
      schedulePersist(`athlete:${athleteId}`, () => persistAthleteStructure(next))
      // If this mutation also changed plans (e.g. via nested callers), they persist separately.
      return { ...prev, [athleteId]: next }
    })
  }

  function patchPlan(mutator) {
    if (!selectedBlock || !athleteId) return
    const blockId = selectedBlock.id
    const blockWeeks = selectedBlock.weeks
    setAthletes((prev) => {
      const current = prev[athleteId]
      if (!current) return prev
      const base = syncPlanLength(current.plans[blockId] || emptyPlan(blockWeeks), blockWeeks)
      const nextPlan = mutator(base, current)
      const next = { ...current, plans: { ...current.plans, [blockId]: nextPlan } }
      schedulePersist(`plan:${athleteId}:${blockId}`, () => persistPlan(athleteId, blockId, nextPlan))
      return { ...prev, [athleteId]: next }
    })
  }

  function ensureBlock(id, opts = {}, person = athletes[athleteId]) {
    if (!person) return
    const blockList = normalizeBlocks(person.blocks, runwayWeeks(person))
    const block = blockList.find((b) => b.id === id)
    if (!block) return
    const hadPlan = Boolean(person.plans[id])
    const synced = syncPlanLength(person.plans[id] || emptyPlan(block.weeks), block.weeks)
    setAthletes((prev) => {
      const current = prev[person.id]
      if (!current) return prev
      const nextPlan = syncPlanLength(current.plans[id] || emptyPlan(block.weeks), block.weeks)
      const next = {
        ...current,
        plans: {
          ...current.plans,
          [id]: nextPlan,
        },
      }
      // Only write when creating a missing plan or length-syncing an existing one.
      const prevLen = current.plans[id]?.weeks?.length
      if (!hadPlan || prevLen !== nextPlan.weeks.length) {
        schedulePersist(`plan:${person.id}:${id}`, () => persistPlan(person.id, id, nextPlan))
      }
      return { ...prev, [person.id]: next }
    })
    let week = opts.week ?? 0
    let day = opts.day ?? 0
    if (opts.jumpToday) {
      const hit = sessionAt(person.startDate, synced, todayISO())
      if (hit) {
        week = hit.weekIndex
        day = hit.dayIndex
      }
    }
    setSelectedBlockId(id)
    setSelectedWeek(week)
    setSelectedDay(day)
    if (opts.stage) setStage(opts.stage)
  }

  function openPerson(person, asRole) {
    setRole(asRole)
    setAthleteId(person.id)
    setScreen('app')
    setPage(asRole === 'coach' ? 'programme' : 'today')
    if (asRole === 'athlete') {
      const blockList = normalizeBlocks(person.blocks, runwayWeeks(person))
      if (blockList[0]) ensureBlock(blockList[0].id, { jumpToday: true }, person)
      else {
        setSelectedBlockId(null)
        setSelectedWeek(0)
        setSelectedDay(0)
      }
    } else {
      setSelectedBlockId(null)
      setSelectedWeek(0)
      setSelectedDay(0)
      setStage('macro')
    }
  }

  async function connectAthlete(id, enter = false) {
    const person = athletes[id]
    if (!person) return
    if (person.coachId === coach.id) {
      setToast(`${person.name} is already connected`)
      if (enter) openPerson(person, 'athlete')
      return
    }
    try {
      await updateAthleteCoachId(id, coach.id)
      const next = { ...person, coachId: coach.id }
      setAthletes((prev) => ({ ...prev, [id]: { ...prev[id], coachId: coach.id } }))
      setToast(`${person.name} connected to ${coach.name}`)
      if (enter) openPerson(next, 'athlete')
    } catch (err) {
      console.error('[supabase] connect failed', err)
      setToast(err?.message || formatSupabaseError(err, 'connect'))
    }
  }

  function submitCode(raw, athleteTarget) {
    const code = raw.trim().toUpperCase()
    if (!code) {
      setToast('Enter a code')
      return
    }
    if (role === 'coach') {
      if (code === coach.code) {
        setToast('Ask the athlete for their code')
        return
      }
      const found = Object.values(athletes).find((a) => a.code === code)
      if (!found) {
        setToast('No athlete with that code')
        return
      }
      connectAthlete(found.id, false)
      return
    }
    if (!athleteTarget) return
    if (code === coach.code) {
      connectAthlete(athleteTarget, true)
      return
    }
    if (Object.values(athletes).some((a) => a.code === code)) {
      setToast(`Use your coach’s code, ${coach.code}`)
      return
    }
    setToast('No coach with that code')
  }

  async function copyCode(text) {
    try {
      await navigator.clipboard.writeText(text)
      setToast('Code copied')
    } catch {
      setToast(text)
    }
  }

  async function logSet({ block, weekIndex, dayIndex, row, weight, reps, rpe, shifted, date, media }) {
    const caption = setCaption({ setNumber: row.setNumber, reps, weight, rpe })
    const e1 = row.lift ? e1FromSet(weight, reps, rpe) : null
    const current = athletes[athleteId]
    if (!current) return

    const existing = findLog(current.logs, block.id, weekIndex, dayIndex, row.setKey)
    let videos = current.videos
    let videoId = existing?.videoId || null
    let uploadedUrl = null

    if (media) {
      videoId = videoId || uid()
      uploadedUrl = await uploadMedia(current.id, videoId, media)
      const video = {
        id: videoId,
        logId: existing?.id || null,
        date,
        blockId: block.id,
        blockName: block.name,
        weekIndex,
        dayIndex,
        setNumber: row.setNumber,
        exercise: row.exercise,
        label: row.label,
        lift: row.lift,
        reps,
        weight,
        rpe,
        url: uploadedUrl || media.url,
        type: media.type,
        name: media.name,
        caption,
      }
      videos = [video, ...videos.filter((v) => v.id !== videoId)]
    } else if (videoId) {
      videos = videos.map((v) => (v.id === videoId ? {
        ...v,
        date,
        reps,
        weight,
        rpe,
        caption,
        setNumber: row.setNumber,
        exercise: row.exercise,
        label: row.label,
        lift: row.lift,
      } : v))
    }

    const log = {
      id: existing?.id || uid(),
      setKey: row.setKey,
      blockId: block.id,
      weekIndex,
      dayIndex,
      setNumber: row.setNumber,
      exercise: row.exercise,
      label: row.label,
      lift: row.lift,
      weight,
      reps,
      rpe,
      e1,
      date,
      videoId,
    }
    if (videoId) videos = videos.map((v) => (v.id === videoId ? { ...v, logId: log.id } : v))

    let e1rmSeries = current.e1rmSeries
    let e1rm = current.e1rm
    let seriesPoint = null
    if (row.lift && e1) {
      e1rmSeries = pushE1rm(current.e1rmSeries, row.lift, e1, date)
      seriesPoint = e1rmSeries.find((p) => p.date === date) || e1rmSeries[e1rmSeries.length - 1]
      e1rm = { ...current.e1rm, [row.lift]: seriesPoint[row.lift] }
    }

    let scheduleOverrides = current.scheduleOverrides
    let newOverride = null
    if (shifted) {
      newOverride = {
        blockId: block.id,
        weekIndex,
        dayIndex,
        prescribedWeekday: WEEKDAYS[dayIndex],
        actualWeekday: WEEKDAYS[(new Date().getDay() + 6) % 7],
        date: todayISO(),
      }
      scheduleOverrides = [
        ...current.scheduleOverrides.filter((o) => !(o.blockId === block.id && o.weekIndex === weekIndex && o.dayIndex === dayIndex)),
        newOverride,
      ]
    }

    const nextAthlete = {
      ...current,
      logs: [log, ...current.logs.filter((l) => l.id !== log.id)],
      videos,
      e1rm,
      e1rmSeries,
      scheduleOverrides,
    }
    setAthletes((prev) => ({ ...prev, [athleteId]: nextAthlete }))

    try {
      if (media && videoId) {
        const videoRow = videos.find((v) => v.id === videoId)
        await upsertVideo(current.id, { ...videoRow, url: uploadedUrl || videoRow.url, logId: null })
      } else if (videoId && !media) {
        const videoRow = videos.find((v) => v.id === videoId)
        if (videoRow) await upsertVideo(current.id, videoRow)
      }
      await upsertSetLog(current.id, log)
      if (videoId) {
        const videoRow = videos.find((v) => v.id === videoId)
        if (videoRow) await upsertVideo(current.id, { ...videoRow, logId: log.id })
      }
      if (seriesPoint) {
        await upsertE1rmPoint(current.id, seriesPoint)
        await persistAthleteStructure({ ...nextAthlete, e1rm })
      }
      if (newOverride) await upsertScheduleOverride(current.id, newOverride)
      const estimate = e1 ? ` · e1RM ${fmtKg(e1)}` : ''
      setToast(media ? `Clip saved · ${caption}${estimate}` : `Logged · ${caption}${estimate}`)
    } catch (err) {
      console.error('[supabase] logSet failed', err)
      setToast(err?.message || formatSupabaseError(err, 'log set'))
      setSaveState('error')
    }
  }

  const markRead = useCallback((id) => {
    setMessages((prev) => {
      const thread = prev[id] || []
      if (!thread.some((m) => m.unread && m.from !== role)) return prev
      return {
        ...prev,
        [id]: thread.map((m) => (m.unread && m.from !== role ? { ...m, unread: false } : m)),
      }
    })
    markMessagesRead(id, role).catch((err) => {
      console.error('[supabase] markRead failed', err)
    })
  }, [role])

  async function sendMessage(id, from, text, attachment) {
    let storedAttachment = attachment
    const msgId = uid()
    if (attachment) {
      const publicUrl = await uploadMedia(id, `msg-${msgId}`, attachment)
      storedAttachment = publicUrl
        ? { ...attachment, url: publicUrl }
        : { ...attachment }
    }
    const msg = {
      id: msgId,
      from,
      text: text.trim(),
      at: new Date().toISOString(),
      attachment: storedAttachment,
      unread: true,
    }
    setMessages((prev) => ({ ...prev, [id]: [...(prev[id] || []), msg] }))
    try {
      await insertMessage(id, msg)
    } catch (err) {
      console.error('[supabase] sendMessage failed', err)
      setToast(err?.message || formatSupabaseError(err, 'send message'))
      setSaveState('error')
    }
  }

  function openVideoDay(video) {
    if (video.weekIndex == null || !video.blockId) return
    ensureBlock(video.blockId, {
      week: video.weekIndex,
      day: video.dayIndex,
      stage: role === 'coach' ? 'day' : undefined,
    })
    setPage(role === 'athlete' ? 'today' : 'programme')
  }

  function setStartDate(value) {
    patchAthlete((c) => ({ ...c, startDate: value }))
  }

  const nav = role === 'coach'
    ? [
      ['programme', 'Programme', LayoutGrid],
      ['progress', 'Progress', TrendingUp],
      ['messages', 'Messages', MessageCircle],
      ['videos', 'Videos', Video],
    ]
    : [
      ['today', 'Today', Dumbbell],
      ['programme', 'Programme', LayoutGrid],
      ['progress', 'Progress', TrendingUp],
      ['messages', 'Messages', MessageCircle],
      ['videos', 'Videos', Video],
    ]

  if (boot.status === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#07080b] font-sans text-zinc-400">
        <div className="text-center">
          <div className="font-display text-3xl tracking-[0.14em] text-white">IRON//WORKBENCH</div>
          <p className="mt-3 text-sm">Loading workspace from Supabase…</p>
        </div>
      </div>
    )
  }

  if (boot.status === 'error') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#07080b] px-4 font-sans text-zinc-300">
        <div className="max-w-md rounded-xl border border-orange-400/30 bg-[#140f0c] p-5">
          <div className="font-display text-2xl text-white">Supabase connection failed</div>
          <p className="mt-2 text-sm text-zinc-400">{boot.error}</p>
          <p className="mt-3 text-xs text-zinc-500">
            Check that `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then restart the Vite dev server.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-black"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'role' || !role) {
    return <RoleGate onChoose={(next) => { setRole(next); setScreen('connect') }} />
  }

  if (screen === 'connect' || !athlete) {
    return (
      <>
        <ConnectGate
          role={role}
          coach={coach}
          athletes={athletes}
          initialAthleteId={role === 'athlete' ? athleteId : null}
          onConnect={connectAthlete}
          onOpen={(id) => openPerson(athletes[id], role)}
          onCode={submitCode}
          onBack={() => { setScreen('role'); setRole(null) }}
          onCopy={copyCode}
        />
        {toast && <Toast text={toast} tone={role} />}
        {saveState === 'saving' && !toast && <Toast text="Saving…" tone={role} />}
        {saveState === 'error' && !toast && <Toast text="Save failed — check console" tone={role} />}
      </>
    )
  }

  const accent = role === 'coach' ? 'bg-cyan-400 text-black' : 'bg-lime-400 text-black'

  return (
    <div className="min-h-svh bg-[#07080b] font-sans text-zinc-200">
      <header className="border-b border-white/8 bg-[#0b0d12]">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => setScreen('connect')} className="flex items-center gap-3 text-left">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400 text-black"><Zap size={18} /></div>
            <div>
              <div className="font-display text-xl tracking-[0.14em] text-white">IRON//WORKBENCH</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{role === 'coach' ? `Coach · ${coach.name}` : `Athlete · ${athlete.name}`}</div>
            </div>
          </button>
          {role === 'coach' ? (
            <div className="relative min-w-[200px]">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Athlete</div>
              <div className="relative">
                <select value={athleteId} onChange={(e) => { setAthleteId(e.target.value); setSelectedBlockId(null); setSelectedWeek(0); setSelectedDay(0); setStage('macro') }} className="w-full appearance-none rounded-lg border border-white/10 bg-[#151821] py-2 pl-3 pr-8 text-sm">
                  {connected.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500" />
              </div>
            </div>
          ) : (
            <div className="text-sm text-zinc-400">Coach {coach.name}</div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setScreen('connect')} className="rounded-md border border-white/10 px-3 py-1.5 text-xs uppercase tracking-wider text-zinc-400">
              {role === 'coach' ? 'Roster' : 'Switch'}
            </button>
            <button type="button" onClick={() => { setScreen('role'); setRole(null) }} className="rounded-md border border-white/10 px-3 py-1.5 text-xs uppercase tracking-wider text-zinc-400">Change role</button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 pb-3">
          {nav.map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setPage(id)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs uppercase tracking-wider ${page === id ? accent : 'text-zinc-400'}`}>
              <Icon size={14} />
              {label}
              {id === 'messages' && messageBadge > 0 && <span className={`rounded-full px-1.5 text-[10px] font-semibold ${role === 'coach' ? 'bg-cyan-400 text-black' : 'bg-lime-400 text-black'}`}>{messageBadge}</span>}
              {id === 'videos' && athlete.videos.length > 0 && <span className="text-[10px] opacity-70">{athlete.videos.length}</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-4 px-4 py-4">
        {role === 'coach' && page === 'programme' && (
          <CoachProgramme
            client={athlete}
            blocks={blocks}
            weeks={weeks}
            selectedBlockId={selectedBlockId}
            selectedWeek={selectedWeek}
            selectedDay={selectedDay}
            stage={stage}
            setStage={setStage}
            setSelectedWeek={setSelectedWeek}
            setSelectedDay={setSelectedDay}
            selectBlock={(id) => ensureBlock(id, { stage: 'micro' })}
            patchClient={patchAthlete}
            patchPlan={patchPlan}
          />
        )}
        {role === 'athlete' && page === 'today' && (
          <AthleteToday
            client={athlete}
            blocks={blocks}
            plan={plan}
            selectedBlock={selectedBlock}
            selectedBlockId={selectedBlockId}
            selectedWeek={selectedWeek}
            selectedDay={selectedDay}
            blockStart={blockStart}
            totalWeeks={weeks}
            onSelectBlock={(id) => ensureBlock(id, { jumpToday: true })}
            onSelectWeek={setSelectedWeek}
            onSelectDay={setSelectedDay}
            onCommit={logSet}
          />
        )}
        {role === 'athlete' && page === 'programme' && (
          <AthleteProgramme
            client={athlete}
            blocks={blocks}
            weeks={weeks}
            plan={plan}
            selectedBlock={selectedBlock}
            selectedBlockId={selectedBlockId}
            blockStart={blockStart}
            onSelectBlock={(id) => ensureBlock(id)}
            onOpenDay={(weekIndex, dayIndex) => { setSelectedWeek(weekIndex); setSelectedDay(dayIndex); setPage('today') }}
            onStartDate={setStartDate}
          />
        )}
        {page === 'progress' && <ProgressPage athlete={athlete} viewer={role} />}
        {page === 'messages' && (
          <MessagesPage
            key={athlete.id}
            role={role}
            coach={coach}
            athlete={athlete}
            athletes={athletes}
            messages={messages}
            onSend={sendMessage}
            onOpenThread={(id) => { setAthleteId(id); setSelectedBlockId(null); setSelectedWeek(0); setSelectedDay(0); setStage('macro') }}
            onMarkRead={markRead}
          />
        )}
        {page === 'videos' && <VideosPage athlete={athlete} role={role} onOpenDay={openVideoDay} />}
      </main>
      {toast && <Toast text={toast} tone={role} />}
      {saveState === 'saving' && !toast && <Toast text="Saving…" tone={role} />}
      {saveState === 'error' && !toast && <Toast text="Save failed — check console" tone={role} />}
    </div>
  )
}

function Toast({ text, tone }) {
  return (
    <div className={`fixed bottom-4 left-4 z-40 max-w-md rounded-lg border px-3 py-2 font-mono text-xs ${tone === 'athlete' ? 'border-lime-400/30 bg-[#10140d] text-lime-200' : 'border-cyan-400/30 bg-[#0c1214] text-cyan-100'}`}>
      {text}
    </div>
  )
}
