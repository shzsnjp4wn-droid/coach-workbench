import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Dumbbell, LayoutGrid, MessageCircle, Settings, TrendingUp, Video, Zap } from 'lucide-react'
import { AccountSettings } from './components/AccountSettings'
import { AthleteProgramme } from './components/AthleteProgramme'
import { AthleteToday } from './components/AthleteToday'
import { CoachProgramme } from './components/CoachProgramme'
import { ConnectGate, ProfileGate, RoleGate } from './components/Gates'
import { MessagesPage } from './components/MessagesPage'
import { ProgressPage } from './components/ProgressPage'
import { VideosPage } from './components/VideosPage'
import {
  COACH as FALLBACK_COACH,
  WEEKDAYS,
  createAthleteProfile,
  createCoachProfile,
  currentGl,
  e1FromSet,
  emptyPlan,
  estimatedTotalKg,
  findLog,
  fmtKg,
  formatMeetDate,
  messagesForPair,
  normalizeBlocks,
  pushE1rm,
  runwayWeeks,
  scopeAthleteForCoach,
  sessionAt,
  setCaption,
  syncPlanLength,
  todayISO,
  uid,
  unreadCount,
} from './domain'
import {
  allocateUniqueUserCode,
  cancelConnectionRequest,
  confirmEmailVerification,
  consumeAuthRedirect,
  createConnectionRequest,
  deleteAccount,
  deleteVideo,
  endActiveStint,
  fetchConnectionRequests,
  fetchWorkspace,
  formatSupabaseError,
  insertAthleteWithStructure,
  insertCoach,
  insertMessage,
  markMessagesRead,
  persistAthleteStructure,
  persistPlan,
  requestEmailVerification,
  respondConnectionRequest,
  startCoachingStint,
  uploadMedia,
  upsertE1rmPoint,
  upsertScheduleOverride,
  upsertSetLog,
  upsertVideo,
} from './supabaseClient'

// Coalesce bursty keystrokes into one write on the next macrotask (not hundreds of ms).
const PERSIST_DEBOUNCE_MS = 0
const SESSION_KEY = 'iw_session'

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
  } catch {
    return null
  }
}

function writeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export default function App() {
  const [boot, setBoot] = useState({ status: 'loading', error: null })
  const [coaches, setCoaches] = useState([])
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
  const [connectionRequests, setConnectionRequests] = useState([])
  const [showAccountSettings, setShowAccountSettings] = useState(false)
  const persistTimers = useRef({})
  const persistFns = useRef({})
  const athletesRef = useRef(athletes)
  const messagesRef = useRef(messages)
  const athleteIdRef = useRef(athleteId)
  const bootGenRef = useRef(0)
  const toastRef = useRef(setToast)
  toastRef.current = setToast
  athletesRef.current = athletes
  messagesRef.current = messages
  athleteIdRef.current = athleteId

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
    const gen = ++bootGenRef.current
    let cancelled = false
    async function bootFromSupabase() {
      setBoot({ status: 'loading', error: null })
      try {
        const authRedirect = await consumeAuthRedirect()
        if (cancelled || gen !== bootGenRef.current) return
        if (authRedirect.kind === 'error') {
          setToast(authRedirect.message || 'Email confirmation link failed')
        } else if (authRedirect.kind === 'confirmed') {
          setToast(authRedirect.email
            ? `Email confirmed · ${authRedirect.email}`
            : 'Email confirmed — continue in the app')
        }

        const [workspace, requests] = await Promise.all([
          fetchWorkspace(),
          fetchConnectionRequests(),
        ])
        if (cancelled || gen !== bootGenRef.current) return
        if (!workspace.coaches.length) {
          throw new Error('No coaches found in Supabase. Run the seed script after schema setup.')
        }
        if (!Object.keys(workspace.athletes).length) {
          throw new Error('No athletes found in Supabase. Run npm run seed:supabase.')
        }
        // Use DB rows only — do not merge createWorkspace() / domain mock presets.
        const nextCoaches = workspace.coaches.length ? workspace.coaches : [FALLBACK_COACH]
        setCoaches(nextCoaches)
        setAthletes(workspace.athletes)
        setMessages(workspace.messages)
        setConnectionRequests(requests)
        athletesRef.current = workspace.athletes
        messagesRef.current = workspace.messages

        const session = readSession()
        if (session?.role === 'coach' && session.coachId) {
          const found = nextCoaches.find((c) => c.id === session.coachId)
          if (found) {
            setCoach(found)
            setRole('coach')
            setScreen('connect')
          } else {
            setCoach(nextCoaches.find((c) => c.id === FALLBACK_COACH.id) || nextCoaches[0])
          }
        } else if (session?.role === 'athlete' && session.athleteId && workspace.athletes[session.athleteId]) {
          const person = workspace.athletes[session.athleteId]
          setAthleteId(person.id)
          setRole('athlete')
          const linked = nextCoaches.find((c) => c.id === person.coachId)
          setCoach(linked || nextCoaches.find((c) => c.id === FALLBACK_COACH.id) || nextCoaches[0])
          setScreen('connect')
        } else {
          setCoach(nextCoaches.find((c) => c.id === FALLBACK_COACH.id) || nextCoaches[0])
        }
        setBoot({ status: 'ready', error: null })
      } catch (err) {
        if (cancelled || gen !== bootGenRef.current) return
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

  const rawAthlete = athleteId ? athletes[athleteId] : null
  const activeUnitCoachId = role === 'coach'
    ? coach?.id
    : (rawAthlete?.coachId || coach?.id || null)
  const athlete = useMemo(() => {
    if (!rawAthlete) return null
    if (role === 'coach') {
      return scopeAthleteForCoach(rawAthlete, coach?.id, rawAthlete.activeStint)
    }
    return rawAthlete
  }, [rawAthlete, role, coach?.id, rawAthlete?.activeStint])
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
  const pairMessages = useMemo(() => {
    if (!athleteId || !activeUnitCoachId) return messages
    return {
      ...messages,
      [athleteId]: messagesForPair(messages, athleteId, activeUnitCoachId),
    }
  }, [messages, athleteId, activeUnitCoachId])

  useEffect(() => {
    if (!toast) return undefined
    const id = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(id)
  }, [toast])

  const connected = Object.values(athletes).filter((a) => a.coachId === coach.id)
  const messageBadge = role === 'coach'
    ? connected.reduce((sum, person) => sum + unreadCount(pairMessages, person.id, 'coach'), 0)
    : (athlete ? unreadCount(pairMessages, athlete.id, 'athlete') : 0)

  function patchAthlete(mutator) {
    const id = athleteIdRef.current
    const current = athletesRef.current[id]
    if (!current) return
    const next = mutator({ ...current })
    const result = { ...athletesRef.current, [id]: next }
    athletesRef.current = result
    setAthletes(result)
    schedulePersist(`athlete:${id}`, async () => {
      const latest = athletesRef.current[id]
      if (latest) await persistAthleteStructure(latest, activeUnitCoachId || latest.coachId)
    })
  }

  function patchPlan(mutator) {
    const id = athleteIdRef.current
    if (!selectedBlock || !id) return
    const blockId = selectedBlock.id
    const blockWeeks = selectedBlock.weeks
    const current = athletesRef.current[id]
    if (!current) return
    const cid = activeUnitCoachId || current.coachId
    const base = syncPlanLength(current.plans[blockId] || emptyPlan(blockWeeks), blockWeeks)
    const nextPlan = { ...mutator(base, current), coachId: cid }
    const next = { ...current, plans: { ...current.plans, [blockId]: nextPlan } }
    const result = { ...athletesRef.current, [id]: next }
    athletesRef.current = result
    setAthletes(result)
    schedulePersist(`plan:${id}:${blockId}`, async () => {
      const planRow = athletesRef.current[id]?.plans?.[blockId]
      if (planRow) await persistPlan(id, blockId, planRow, cid)
    })
  }

  function ensureBlock(id, opts = {}, person = athletesRef.current[athleteIdRef.current]) {
    if (!person) return
    const blockList = normalizeBlocks(person.blocks, runwayWeeks(person))
    const block = blockList.find((b) => b.id === id)
    if (!block) return
    const existing = person.plans[id]
    const synced = syncPlanLength(existing || emptyPlan(block.weeks), block.weeks)
    const current = athletesRef.current[person.id] || person
    const nextPlan = syncPlanLength(current.plans[id] || emptyPlan(block.weeks), block.weeks)
    const next = {
      ...current,
      plans: {
        ...current.plans,
        [id]: nextPlan,
      },
    }
    const result = { ...athletesRef.current, [person.id]: next }
    athletesRef.current = result
    setAthletes(result)
    // Never auto-write a brand-new empty plan (that overwrites nothing useful and
    // can race with real edits). Only persist when length-syncing an existing plan.
    if (existing && (existing.weeks?.length || 0) !== nextPlan.weeks.length) {
      schedulePersist(`plan:${person.id}:${id}`, async () => {
        const plan = athletesRef.current[person.id]?.plans?.[id]
        if (plan) await persistPlan(person.id, id, plan)
      })
    }
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

  function saveSession(next) {
    writeSession(next)
  }

  async function createProfile({ name, sex, bodyweightKg, email }) {
    if (role === 'coach') {
      const code = await allocateUniqueUserCode('coach')
      const profile = createCoachProfile({ name, code, email })
      await insertCoach(profile)
      setCoaches((prev) => [...prev, profile])
      setCoach(profile)
      saveSession({ role: 'coach', coachId: profile.id })
      setToast(`Welcome ${profile.name} · ${profile.code}`)
      setScreen('connect')
      return
    }
    const code = await allocateUniqueUserCode('athlete')
    const profile = createAthleteProfile({ name, code, sex, bodyweightKg, email })
    await insertAthleteWithStructure(profile)
    const nextAthletes = { ...athletesRef.current, [profile.id]: { ...profile, stints: [], activeStint: null } }
    athletesRef.current = nextAthletes
    setAthletes(nextAthletes)
    setMessages((prev) => {
      const next = { ...prev, [profile.id]: prev[profile.id] || [] }
      messagesRef.current = next
      return next
    })
    setAthleteId(profile.id)
    saveSession({ role: 'athlete', athleteId: profile.id })
    setToast(`Welcome ${profile.name} · ${profile.code}`)
    setScreen('connect')
  }

  async function handleDeleteAccount() {
    const id = role === 'coach' ? coach?.id : rawAthlete?.id
    if (!id) return
    await deleteAccount({ role, id })
    if (role === 'coach') {
      setCoaches((prev) => prev.filter((c) => c.id !== id))
      setCoach(FALLBACK_COACH)
    } else {
      const next = { ...athletesRef.current }
      delete next[id]
      athletesRef.current = next
      setAthletes(next)
      setAthleteId(null)
    }
    localStorage.removeItem(SESSION_KEY)
    setScreen('role')
    setRole(null)
    setToast('Account deleted')
  }

  function selectExistingProfile(person) {
    if (role === 'coach') {
      setCoach(person)
      saveSession({ role: 'coach', coachId: person.id })
      setScreen('connect')
      return
    }
    setAthleteId(person.id)
    const linked = coaches.find((c) => c.id === person.coachId)
    if (linked) setCoach(linked)
    saveSession({ role: 'athlete', athleteId: person.id })
    setScreen('connect')
  }

  async function disconnectFromCoach(athletePersonId) {
    const person = athletesRef.current[athletePersonId]
    if (!person?.coachId) {
      setToast('Not connected to a coach')
      return
    }
    try {
      const ended = await endActiveStint(athletePersonId, {
        endTotalKg: estimatedTotalKg(person),
        endDots: currentGl(person),
      })
      const next = {
        ...person,
        coachId: null,
        activeStint: null,
        stints: ended
          ? [ended, ...(person.stints || []).filter((s) => s.id !== ended.id)]
          : (person.stints || []).map((s) => (s.status === 'active' ? { ...s, status: 'ended' } : s)),
      }
      const nextAthletes = { ...athletesRef.current, [athletePersonId]: next }
      athletesRef.current = nextAthletes
      setAthletes(nextAthletes)
      setToast(`Disconnected from coach`)
    } catch (err) {
      console.error('[supabase] disconnect failed', err)
      setToast(err?.message || formatSupabaseError(err, 'disconnect'))
    }
  }

  async function refreshConnectionRequests() {
    try {
      const rows = await fetchConnectionRequests()
      setConnectionRequests(rows)
    } catch (err) {
      console.warn('[supabase] refresh connection requests', err)
    }
  }

  async function finalizeConnection(athletePersonId, coachPersonId, { transferHistory = false, open = false } = {}) {
    const person = athletesRef.current[athletePersonId]
    const targetCoach = coaches.find((c) => c.id === coachPersonId) || coach
    if (!person || !targetCoach) return null
    const stint = await startCoachingStint({
      athleteId: athletePersonId,
      coachId: targetCoach.id,
      transferHistory,
      startBodyweightKg: person.bodyweightKg,
      startTotalKg: estimatedTotalKg(person),
      startDots: currentGl(person),
    })
    const next = {
      ...person,
      coachId: targetCoach.id,
      activeStint: stint,
      stints: [stint, ...(person.stints || []).filter((s) => s.id !== stint.id)],
    }
    const nextAthletes = { ...athletesRef.current, [athletePersonId]: next }
    athletesRef.current = nextAthletes
    setAthletes(nextAthletes)
    setCoach(targetCoach)
    setToast(`${person.name} connected to ${targetCoach.name}`)
    if (open) openPerson(next, role === 'athlete' ? 'athlete' : 'coach')
    return next
  }

  /** Propose a connection — the other party must accept before it becomes active. */
  async function requestConnection(athletePersonId, coachPersonId, { transferHistory = false } = {}) {
    const person = athletesRef.current[athletePersonId]
    const targetCoach = coaches.find((c) => c.id === coachPersonId) || coach
    if (!person || !targetCoach) return
    if (person.coachId === targetCoach.id) {
      setToast(`${person.name} is already connected to ${targetCoach.name}`)
      return
    }
    if (person.coachId && person.coachId !== targetCoach.id) {
      setToast('Disconnect from the current coach before requesting another.')
      return
    }
    try {
      const req = await createConnectionRequest({
        athleteId: athletePersonId,
        coachId: targetCoach.id,
        initiatedBy: role === 'coach' ? 'coach' : 'athlete',
        transferHistory,
      })
      setConnectionRequests((prev) => [req, ...prev.filter((r) => r.id !== req.id)])
      setToast(role === 'coach'
        ? `Request sent to ${person.name} — waiting for their confirmation`
        : `Request sent to ${targetCoach.name} — waiting for their confirmation`)
    } catch (err) {
      console.error('[supabase] connection request failed', err)
      setToast(err?.message || formatSupabaseError(err, 'connection request'))
    }
  }

  async function acceptConnectionRequest(requestId) {
    const pending = connectionRequests.find((r) => r.id === requestId)
    if (!pending) return
    // Only the counterparty can accept.
    if (pending.initiatedBy === 'coach' && role !== 'athlete') {
      setToast('Waiting for the athlete to confirm this request')
      return
    }
    if (pending.initiatedBy === 'athlete' && role !== 'coach') {
      setToast('Waiting for the coach to confirm this request')
      return
    }
    try {
      const updated = await respondConnectionRequest(requestId, 'accepted')
      setConnectionRequests((prev) => prev.filter((r) => r.id !== requestId))
      await finalizeConnection(updated.athleteId, updated.coachId, {
        transferHistory: updated.transferHistory,
        open: false,
      })
      await refreshConnectionRequests()
    } catch (err) {
      console.error('[supabase] accept connection failed', err)
      setToast(err?.message || formatSupabaseError(err, 'accept connection'))
    }
  }

  async function declineConnectionRequest(requestId) {
    try {
      await respondConnectionRequest(requestId, 'declined')
      setConnectionRequests((prev) => prev.filter((r) => r.id !== requestId))
      setToast('Connection request declined')
    } catch (err) {
      console.error('[supabase] decline connection failed', err)
      setToast(err?.message || formatSupabaseError(err, 'decline connection'))
    }
  }

  async function cancelOwnConnectionRequest(requestId) {
    try {
      await cancelConnectionRequest(requestId)
      setConnectionRequests((prev) => prev.filter((r) => r.id !== requestId))
      setToast('Connection request cancelled')
    } catch (err) {
      console.error('[supabase] cancel connection failed', err)
      setToast(err?.message || formatSupabaseError(err, 'cancel connection'))
    }
  }

  async function onCoachSearchConnect(person) {
    if (person.coachId === coach.id) {
      openPerson(athletesRef.current[person.id], 'coach')
      return
    }
    if (person.coachId) {
      setToast(`${person.name} is with another coach — they must disconnect first.`)
      return
    }
    await requestConnection(person.id, coach.id, { transferHistory: true })
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
    const id = athleteIdRef.current
    const current = athletesRef.current[id]
    if (!current) return
    const cid = current.coachId || activeUnitCoachId
    if (!cid) {
      const err = new Error('Connect to a coach before logging sets')
      setToast(err.message)
      setSaveState('error')
      throw err
    }

    const existing = findLog(current.logs, block.id, weekIndex, dayIndex, row.setKey)
    let videos = current.videos
    let videoId = existing?.videoId || null
    let uploadedUrl = null

    try {
      if (media) {
        videoId = videoId || uid()
        // Show the clip immediately (blob), then swap to the durable Storage URL.
        const pendingVideo = {
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
          url: media.url,
          type: media.type || 'video/mp4',
          name: media.name,
          caption,
          coachId: cid,
        }
        videos = [pendingVideo, ...videos.filter((v) => v.id !== videoId)]
        {
          const nextAthletes = { ...athletesRef.current, [id]: { ...current, videos } }
          athletesRef.current = nextAthletes
          setAthletes(nextAthletes)
        }
        setSaveState('saving')
        // Keep a hard reference to the File so state updates can't drop it mid-save.
        uploadedUrl = await uploadMedia(current.id, videoId, {
          file: media.file || null,
          url: media.url,
          name: media.name,
          type: media.type,
        })
        videos = videos.map((v) => (v.id === videoId ? { ...v, url: uploadedUrl } : v))
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
          coachId: cid,
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
        coachId: cid,
      }
      if (videoId) videos = videos.map((v) => (v.id === videoId ? { ...v, logId: log.id, coachId: cid } : v))

      let e1rmSeries = current.e1rmSeries
      let e1rm = current.e1rm
      let seriesPoint = null
      if (row.lift && e1) {
        e1rmSeries = pushE1rm(current.e1rmSeries, row.lift, e1, date).map((p) => (
          p.date === date ? { ...p, coachId: cid } : p
        ))
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
          coachId: cid,
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
      const nextAthletes = { ...athletesRef.current, [id]: nextAthlete }
      athletesRef.current = nextAthletes
      setAthletes(nextAthletes)

      // Persist durable Storage URLs only — never blob: — so Videos survives refresh.
      if (media && videoId && uploadedUrl) {
        const videoRow = videos.find((v) => v.id === videoId)
        await upsertVideo(current.id, { ...videoRow, url: uploadedUrl, logId: null }, cid)
      } else if (videoId && !media) {
        const videoRow = videos.find((v) => v.id === videoId)
        if (videoRow && videoRow.url && !String(videoRow.url).startsWith('blob:')) {
          await upsertVideo(current.id, videoRow, cid)
        }
      }
      await upsertSetLog(current.id, log, cid)
      if (videoId && uploadedUrl) {
        const videoRow = videos.find((v) => v.id === videoId)
        if (videoRow) await upsertVideo(current.id, { ...videoRow, url: uploadedUrl, logId: log.id }, cid)
      } else if (videoId && !media) {
        const videoRow = videos.find((v) => v.id === videoId)
        if (videoRow && videoRow.url && !String(videoRow.url).startsWith('blob:')) {
          await upsertVideo(current.id, { ...videoRow, logId: log.id }, cid)
        }
      }
      if (media?.url?.startsWith('blob:')) {
        try { URL.revokeObjectURL(media.url) } catch { /* ignore */ }
      }
      if (seriesPoint) {
        await upsertE1rmPoint(current.id, { ...seriesPoint, coachId: cid }, cid)
        await persistAthleteStructure({ ...nextAthlete, e1rm }, cid)
      }
      if (newOverride) await upsertScheduleOverride(current.id, newOverride, cid)
      const estimate = e1 ? ` · e1RM ${fmtKg(e1)}` : ''
      setToast(media ? `Clip saved · ${caption}${estimate}` : `Logged · ${caption}${estimate}`)
      setSaveState('saved')
    } catch (err) {
      console.error('[supabase] logSet failed', err)
      setToast(err?.message || formatSupabaseError(err, 'log set'))
      setSaveState('error')
      throw err
    }
  }

  async function removeLoggedVideo({ log, video }) {
    if (!log || !video) return
    const id = athleteIdRef.current
    const current = athletesRef.current[id]
    if (!current) return
    try {
      await deleteVideo(current.id, video.id)
      const nextAthlete = {
        ...current,
        videos: current.videos.filter((v) => v.id !== video.id),
        logs: current.logs.map((l) => (l.id === log.id ? { ...l, videoId: null } : l)),
      }
      const nextAthletes = { ...athletesRef.current, [id]: nextAthlete }
      athletesRef.current = nextAthletes
      setAthletes(nextAthletes)
      setToast('Clip removed')
      setSaveState('saved')
    } catch (err) {
      console.error('[supabase] remove video failed', err)
      setToast(err?.message || formatSupabaseError(err, 'remove video'))
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
    const cid = athletesRef.current[id]?.coachId || coach?.id
    markMessagesRead(id, role, cid).catch((err) => {
      console.error('[supabase] markRead failed', err)
    })
  }, [role, coach?.id])

  async function sendMessage(id, from, text, attachment) {
    const cid = athletesRef.current[id]?.coachId || coach?.id
    if (!cid) {
      setToast('Connect coach ↔ athlete before messaging')
      return
    }
    let storedAttachment = null
    const msgId = uid()
    if (attachment) {
      let publicUrl = ''
      try {
        publicUrl = await uploadMedia(id, `msg-${msgId}`, attachment)
      } catch (err) {
        console.warn('[supabase] message attachment upload failed', err)
        setToast(err?.message || 'Attachment upload failed — message will send without the file URL')
      }
      storedAttachment = {
        name: attachment.name || '',
        type: attachment.type || '',
        size: attachment.size || 0,
        kind: attachment.kind || 'file',
        url: publicUrl || '',
      }
    }
    const msg = {
      id: msgId,
      from,
      text: text.trim(),
      at: new Date().toISOString(),
      attachment: storedAttachment,
      unread: true,
      coachId: cid,
    }
    const nextThread = [...(messagesRef.current[id] || []), msg]
    const nextMessages = { ...messagesRef.current, [id]: nextThread }
    messagesRef.current = nextMessages
    setMessages(nextMessages)
    try {
      await insertMessage(id, msg, cid)
      setSaveState('saved')
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
    return (
      <RoleGate onChoose={(next) => {
        setRole(next)
        setScreen('profile')
      }}
      />
    )
  }

  if (screen === 'profile') {
    return (
      <>
        <ProfileGate
          role={role}
          coaches={coaches}
          athletes={athletes}
          onBack={() => { setScreen('role'); setRole(null) }}
          onRequestCode={requestEmailVerification}
          onConfirmCode={confirmEmailVerification}
          onCreate={async (details) => {
            try {
              await createProfile(details)
            } catch (err) {
              console.error('[supabase] create profile failed', err)
              setToast(err?.message || formatSupabaseError(err, 'create profile'))
              throw err
            }
          }}
          onSelect={selectExistingProfile}
        />
        {toast && <Toast text={toast} tone={role} />}
      </>
    )
  }

  if (screen === 'connect' || (role === 'athlete' && !rawAthlete) || (role === 'coach' && !coach)) {
    return (
      <>
        <ConnectGate
          role={role}
          coach={coach}
          coaches={coaches}
          athletes={athletes}
          selfAthlete={role === 'athlete' ? rawAthlete : null}
          connectionRequests={connectionRequests}
          onOpen={(id) => openPerson(athletes[id], role)}
          onConnectCoach={(coachId, { transferHistory }) => requestConnection(athleteId, coachId, { transferHistory })}
          onDisconnect={() => disconnectFromCoach(athleteId)}
          onSearchConnect={onCoachSearchConnect}
          onAcceptRequest={acceptConnectionRequest}
          onDeclineRequest={declineConnectionRequest}
          onCancelRequest={cancelOwnConnectionRequest}
          onBack={() => { setScreen('profile') }}
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
          <div className="rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-right">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500">Today</div>
            <div className="font-mono text-xs text-zinc-200">{formatMeetDate(todayISO())}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setScreen('connect')} className="rounded-md border border-white/10 px-3 py-1.5 text-xs uppercase tracking-wider text-zinc-400">
              {role === 'coach' ? 'Roster' : 'Connect'}
            </button>
            <button
              type="button"
              onClick={() => { setScreen('profile') }}
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs uppercase tracking-wider text-zinc-400"
            >
              Profiles
            </button>
            <button
              type="button"
              onClick={() => setShowAccountSettings(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs uppercase tracking-wider text-zinc-400"
            >
              <Settings size={12} /> Account
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(SESSION_KEY)
                setScreen('role')
                setRole(null)
                setAthleteId(null)
              }}
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs uppercase tracking-wider text-zinc-400"
            >
              Change role
            </button>
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
            onRemoveVideo={removeLoggedVideo}
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
            selectedWeek={selectedWeek}
            selectedDay={selectedDay}
            onSelectBlock={(id) => ensureBlock(id)}
            onSelectWeek={setSelectedWeek}
            onSelectDay={setSelectedDay}
            onOpenDay={(weekIndex, dayIndex) => { setSelectedWeek(weekIndex); setSelectedDay(dayIndex); setPage('today') }}
            onStartDate={setStartDate}
          />
        )}
        {page === 'progress' && (
          <ProgressPage
            athlete={athlete}
            viewer={role}
            stint={rawAthlete?.activeStint}
            roster={role === 'coach' ? connected : null}
            onBodyweight={(kg) => patchAthlete((c) => ({ ...c, bodyweightKg: Number(kg) }))}
          />
        )}
        {page === 'messages' && (
          <MessagesPage
            key={athlete.id}
            role={role}
            coach={coach}
            athlete={athlete}
            athletes={athletes}
            messages={pairMessages}
            onSend={sendMessage}
            onOpenThread={(id) => { setAthleteId(id); setSelectedBlockId(null); setSelectedWeek(0); setSelectedDay(0); setStage('macro') }}
            onMarkRead={markRead}
          />
        )}
        {page === 'videos' && <VideosPage athlete={athlete} role={role} onOpenDay={openVideoDay} />}
      </main>
      {showAccountSettings && (
        <AccountSettings
          role={role}
          person={role === 'coach' ? coach : rawAthlete}
          onClose={() => setShowAccountSettings(false)}
          onDeleteAccount={async () => {
            await handleDeleteAccount()
            setShowAccountSettings(false)
          }}
        />
      )}
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
