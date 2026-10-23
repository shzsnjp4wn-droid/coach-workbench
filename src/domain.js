export const PLATE = 2.5
export const LIFT_LABEL = { squat: 'Squat', bench: 'Bench', deadlift: 'Deadlift' }
export const LIFT_TONE = {
  squat: 'border-violet-400/40 bg-violet-600/40 text-violet-50',
  bench: 'border-indigo-400/40 bg-indigo-600/35 text-indigo-50',
  deadlift: 'border-fuchsia-400/40 bg-fuchsia-700/35 text-fuchsia-50',
}
export const LIFT_STROKE = { squat: '#c4b5fd', bench: '#a5b4fc', deadlift: '#f0abfc' }
export const RANK_LABEL = { 1: '1°', 2: '2°', 3: '3°', 4: '4°', 5: '5°' }
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const SET_PRESETS = ['Top set', 'Backdown', 'Ascending', 'Pyramid', 'Straight', 'Set']
export const RPE_OPTIONS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]
export const QUICK_MOD = [0.8, 0.85, 0.9, 0.95, 1]
export const DEFAULT_ACCESSORIES = [
  'BB Shoulder Press', 'Hammer Curls', 'Rear Delt Flyes', 'Side Raises',
  'Leg Press', 'Leg Extensions', 'Seated Rows', 'JM Press', 'Ab Crunch', 'RDLs', 'Incline DB Bench',
]
export const RPE_ROWS = {
  10: [1.0, 0.955, 0.922, 0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.707, 0.68],
  9.5: [0.978, 0.939, 0.907, 0.878, 0.85, 0.824, 0.799, 0.774, 0.751, 0.723, 0.694, 0.667],
  9: [0.955, 0.922, 0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.707, 0.68, 0.653],
  8.5: [0.939, 0.907, 0.878, 0.85, 0.824, 0.799, 0.774, 0.751, 0.723, 0.694, 0.667, 0.64],
  8: [0.922, 0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.707, 0.68, 0.653, 0.626],
  7.5: [0.907, 0.878, 0.85, 0.824, 0.799, 0.774, 0.751, 0.723, 0.694, 0.667, 0.64, 0.613],
  7: [0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.707, 0.68, 0.653, 0.626, 0.599],
  6.5: [0.878, 0.85, 0.824, 0.799, 0.774, 0.751, 0.723, 0.694, 0.667, 0.64, 0.613, 0.586],
  6: [0.85, 0.824, 0.799, 0.774, 0.751, 0.723, 0.694, 0.667, 0.64, 0.613, 0.586, 0.56],
  5.5: [0.824, 0.799, 0.774, 0.751, 0.723, 0.694, 0.667, 0.64, 0.613, 0.586, 0.56, 0.534],
  5: [0.799, 0.774, 0.751, 0.723, 0.694, 0.667, 0.64, 0.613, 0.586, 0.56, 0.534, 0.508],
}
export const BLOCK_PALETTE = [
  { surface: 'border-indigo-400/25 bg-indigo-500/15 text-indigo-100', chip: 'border-indigo-400/45' },
  { surface: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-100', chip: 'border-cyan-400/45' },
  { surface: 'border-violet-400/25 bg-violet-500/15 text-violet-100', chip: 'border-violet-400/45' },
  { surface: 'border-amber-400/25 bg-amber-500/10 text-amber-100', chip: 'border-amber-400/45' },
]
export const AVATAR = {
  ola: 'bg-violet-500/30 text-violet-100',
  marcus: 'bg-indigo-500/30 text-indigo-100',
  sofia: 'bg-amber-500/25 text-amber-100',
  sam: 'bg-cyan-400/20 text-cyan-100',
}

export const COACH = {
  id: 'sam',
  name: 'Sam Okonkwo',
  // Fallback only — seed + createCoachProfile mint a random CH-… code.
  code: 'CH-PENDING',
}

/** Fixed pixel width per macro week so extending blocks scrolls instead of compressing. */
export const WEEK_CELL_PX = 72

const uid = () => Math.random().toString(36).slice(2, 9)
export { uid }

/** Unambiguous alphabet (no 0/O/1/I). 32^10 ≈ 1.1e15 bodies per prefix. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const USER_CODE_BODY_LEN = 10

/** Cryptographically strong random body for ATH-/CH- codes (no DB check). */
export function randomCodeBody(length = USER_CODE_BODY_LEN) {
  const bytes = new Uint8Array(length)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return out
}

export function makeAthleteCode() {
  return `ATH-${randomCodeBody()}`
}

export function makeCoachCode() {
  return `CH-${randomCodeBody()}`
}

/** New athlete row for profile creation (no demo logs). Pass a DB-verified `code`. */
export function createAthleteProfile({ name, code }) {
  if (!code) throw new Error('createAthleteProfile requires a unique code from allocateUniqueUserCode')
  const pbs = { squat: 0, bench: 0, deadlift: 0 }
  const meet = isoFromDate(addDays(parseISO(todayISO()), 12 * 7))
  return {
    id: `ath_${uid()}`,
    name: name.trim(),
    code,
    coachId: null,
    event: '',
    meetDate: meet,
    planningMode: 'block',
    blockWeeks: 12,
    startDate: mondayOf(todayISO()),
    pbs,
    e1rm: { ...pbs },
    accessoryLibrary: accessoryLibrary(),
    liftLibrary: defaultLiftLibrary(),
    blocks: [
      { id: 'b1', name: 'Block 1', weeks: 4 },
      { id: 'b2', name: 'Block 2', weeks: 4 },
      { id: 'b3', name: 'Block 3', weeks: 4 },
    ],
    plans: {},
    logs: [],
    videos: [],
    e1rmSeries: [],
    scheduleOverrides: [],
  }
}

/** Pass a DB-verified `code` from allocateUniqueUserCode. */
export function createCoachProfile({ name, code }) {
  if (!code) throw new Error('createCoachProfile requires a unique code from allocateUniqueUserCode')
  return {
    id: `ch_${uid()}`,
    name: name.trim(),
    code,
  }
}

export function matchesUserQuery(person, raw) {
  const q = raw.trim().toLowerCase()
  if (!q) return true
  return (
    person.name.toLowerCase().includes(q)
    || person.code.toLowerCase().includes(q)
    || person.id.toLowerCase().includes(q)
  )
}

export const clone = (v) => JSON.parse(JSON.stringify(v))

export function roundPlate(kg) {
  return Math.round(kg / PLATE) * PLATE
}
export function fmtKg(kg) {
  if (kg == null || kg === '' || Number.isNaN(Number(kg))) return '—'
  const n = roundPlate(Number(kg))
  return Number.isInteger(n) ? `${n}` : n.toFixed(1)
}
export function fmtNum(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  const rounded = Math.round(v * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}
export function setCaption({ setNumber, reps, weight, rpe }) {
  return `Set ${setNumber} · ${fmtNum(reps)} reps · ${fmtNum(weight)} kg · RPE ${fmtNum(rpe)}`
}
export function lookupPct(reps, rpe) {
  const row = RPE_ROWS[rpe] || RPE_ROWS[8]
  return row[Math.min(12, Math.max(1, Math.round(reps))) - 1] ?? row[4]
}
export function meetMs(iso) {
  return new Date(`${iso}T00:00:00`).getTime()
}
export function weeksOutFrom(meetDate) {
  return Math.max(1, Math.ceil((meetMs(meetDate) - Date.now()) / (7 * 24 * 60 * 60 * 1000)))
}
export function runwayWeeks(client) {
  return client.planningMode === 'block' ? Math.max(1, Number(client.blockWeeks) || 16) : weeksOutFrom(client.meetDate)
}
export function formatMeetDate(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
export function formatDay(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}
export function formatShortDay(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
export function parseISO(iso) {
  return new Date(`${iso}T12:00:00`)
}
export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}
export function isoFromDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export function todayISO() {
  return isoFromDate(new Date())
}
export function mondayOf(iso) {
  const d = parseISO(iso)
  const offset = (d.getDay() + 6) % 7
  return isoFromDate(addDays(d, -offset))
}
export function formatMessageDay(iso) {
  const date = iso.slice(0, 10)
  const today = todayISO()
  const yesterday = isoFromDate(addDays(parseISO(today), -1))
  if (date === today) return 'Today'
  if (date === yesterday) return 'Yesterday'
  return formatDay(date)
}
export function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
export function initials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}
export function fileToMedia(file) {
  const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : 'file'
  return {
    url: URL.createObjectURL(file),
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    kind,
  }
}
export function atDaysAgo(days, hours, minutes) {
  const d = addDays(parseISO(todayISO()), -days)
  d.setHours(hours, minutes, 0, 0)
  return d.toISOString()
}

export function normalizeBlocks(blocks, weeks) {
  const source = blocks.length ? blocks : [{ id: uid(), name: 'Block 1', weeks }]
  const total = source.reduce((s, b) => s + b.weeks, 0)
  if (total === weeks) return source
  if (total < weeks) {
    const last = source[source.length - 1]
    return [...source.slice(0, -1), { ...last, weeks: last.weeks + (weeks - total) }]
  }
  const next = []
  let remaining = weeks
  for (const b of source) {
    if (remaining <= 0) break
    next.push({ ...b, weeks: Math.min(b.weeks, remaining) })
    remaining -= Math.min(b.weeks, remaining)
  }
  return next
}
export function defaultLiftLibrary() {
  return {
    squat: [{ id: uid(), name: 'Comp Squat', modifier: 1 }],
    bench: [{ id: uid(), name: 'Comp Bench', modifier: 1 }],
    deadlift: [{ id: uid(), name: 'Comp Deadlift', modifier: 1 }],
  }
}
export function defaultExercise(library, lift) {
  return library[lift]?.[0] || { name: `Comp ${LIFT_LABEL[lift]}`, modifier: 1 }
}
export function makeSetGroup(exercise, label = 'Top set', count = 1, reps = 5, rpe = 8) {
  return {
    id: uid(),
    label,
    count,
    reps,
    rpe,
    floor: '',
    cap: '',
    exercise: exercise?.name || 'Comp Squat',
    modifier: exercise?.modifier ?? 1,
  }
}
export function makeMainItem(lift, rank, library) {
  const ex = defaultExercise(library, lift)
  return { id: uid(), kind: 'main', lift, rank, setGroups: [makeSetGroup(ex)] }
}
export function makeAccItem(name) {
  return {
    id: uid(),
    kind: 'accessory',
    name,
    setGroups: [makeSetGroup({ name, modifier: 0 }, 'Straight', 3, 10, 7)],
  }
}
export function emptyDay(weekdayIndex, active = false) {
  return { id: uid(), weekday: weekdayIndex, active, items: [] }
}
export function emptyWeek() {
  return { days: WEEKDAYS.map((_, i) => emptyDay(i, i < 6)) }
}
export function emptyPlan(weekCount) {
  return {
    sameEveryWeek: true,
    frequency: { squat: 2, bench: 2, deadlift: 1 },
    weeks: Array.from({ length: weekCount }, emptyWeek),
  }
}
export function syncPlanLength(plan, weekCount) {
  let weeks = [...(plan.weeks || [])]
  while (weeks.length < weekCount) weeks.push(clone(weeks[weeks.length - 1] || emptyWeek()))
  weeks = weeks.slice(0, weekCount).map((week) => {
    const days = WEEKDAYS.map((_, i) => week.days[i] || emptyDay(i, false))
    return { days }
  })
  return { ...plan, weeks }
}
export function dayItems(day) {
  return day?.items || []
}
export function dayTitle(day) {
  const mains = dayItems(day).filter((i) => i.kind === 'main')
  if (!day?.active) return 'Rest'
  return mains.map((m) => `${RANK_LABEL[m.rank]} ${LIFT_LABEL[m.lift]}`).join(', ') || 'Empty day'
}
export function highCns(day) {
  const mains = dayItems(day).filter((i) => i.kind === 'main')
  return mains.some((m) => m.lift === 'squat' && m.rank === 1) && mains.some((m) => m.lift === 'deadlift' && m.rank === 1)
}
export function loadFromChart(pb, reps, rpe, modifier = 1) {
  const mod = modifier > 0 ? modifier : 1
  return roundPlate(pb * mod * lookupPct(reps, rpe))
}
export function isPlaced(week, lift, rank) {
  return week.days.some((d) => dayItems(d).some((i) => i.kind === 'main' && i.lift === lift && i.rank === rank))
}
export function calendarDate(startISO, weekIndex, dayIndex) {
  return addDays(parseISO(startISO), weekIndex * 7 + dayIndex)
}
export function sessionAt(startISO, plan, iso) {
  const diff = Math.round((parseISO(iso) - parseISO(startISO)) / 86_400_000)
  if (diff < 0 || !plan) return null
  const weekIndex = Math.floor(diff / 7)
  const dayIndex = diff % 7
  if (weekIndex >= plan.weeks.length) return null
  return { weekIndex, dayIndex, day: plan.weeks[weekIndex].days[dayIndex] }
}
export function e1FromSet(weight, reps, rpe) {
  const pct = lookupPct(reps, rpe)
  if (!pct) return null
  return roundPlate(weight / pct)
}
export function pushE1rm(series, lift, e1, date) {
  const next = (series || []).map((p) => ({ ...p }))
  const idx = next.findIndex((p) => p.date === date)
  if (idx >= 0) {
    const prev = next[idx][lift]
    next[idx][lift] = prev == null ? e1 : Math.max(prev, e1)
    return next
  }
  const prior = [...next].reverse().find((p) => p.date < date) || {}
  next.push({
    date,
    squat: prior.squat ?? null,
    bench: prior.bench ?? null,
    deadlift: prior.deadlift ?? null,
    [lift]: e1,
  })
  next.sort((a, b) => a.date.localeCompare(b.date))
  return next
}
export function latestEstimates(athlete) {
  const last = athlete.e1rmSeries?.[athlete.e1rmSeries.length - 1]
  return {
    squat: last?.squat ?? athlete.e1rm.squat,
    bench: last?.bench ?? athlete.e1rm.bench,
    deadlift: last?.deadlift ?? athlete.e1rm.deadlift,
  }
}
export function totalOf(estimates) {
  return Number(estimates.squat || 0) + Number(estimates.bench || 0) + Number(estimates.deadlift || 0)
}
export function expandDaySets(day, client) {
  const rows = []
  let setNumber = 1
  dayItems(day).forEach((item, itemIndex) => {
    item.setGroups.forEach((group, groupIndex) => {
      const count = Math.max(1, Number(group.count) || 1)
      for (let i = 0; i < count; i += 1) {
        const prescribedKg = item.kind === 'main'
          ? loadFromChart(client.pbs[item.lift], group.reps, group.rpe, group.modifier)
          : (group.cap !== '' && group.cap != null ? Number(group.cap) : null)
        rows.push({
          setKey: `${itemIndex}:${groupIndex}:${i}`,
          setNumber: setNumber++,
          item,
          group,
          exercise: item.kind === 'main' ? `${RANK_LABEL[item.rank]} ${group.exercise}` : item.name,
          label: group.label,
          lift: item.kind === 'main' ? item.lift : null,
          prescribedReps: group.reps,
          prescribedRpe: group.rpe,
          prescribedKg,
          floor: group.floor,
          cap: group.cap,
          count,
          indexInGroup: i,
        })
      }
    })
  })
  return rows
}

function mainBlock(library, lift, rank, groups) {
  const ex = defaultExercise(library, lift)
  return {
    id: uid(),
    kind: 'main',
    lift,
    rank,
    setGroups: groups.map(([label, count, reps, rpe]) => makeSetGroup(ex, label, count, reps, rpe)),
  }
}

export function publishedPlan(library, weekCount) {
  const days = WEEKDAYS.map((_, i) => emptyDay(i, i < 5))
  days[0].items = [
    mainBlock(library, 'squat', 1, [['Top set', 1, 3, 8], ['Backdown', 3, 5, 7]]),
    makeAccItem('Leg Press'),
  ]
  days[1].items = [
    mainBlock(library, 'bench', 1, [['Top set', 1, 3, 8], ['Backdown', 3, 5, 7]]),
    makeAccItem('JM Press'),
  ]
  days[2].items = [
    mainBlock(library, 'squat', 2, [['Top set', 1, 4, 7], ['Backdown', 3, 6, 6]]),
    makeAccItem('Seated Rows'),
  ]
  days[3].items = [
    mainBlock(library, 'deadlift', 1, [['Top set', 1, 2, 8], ['Backdown', 3, 3, 7]]),
    makeAccItem('RDLs'),
  ]
  days[4].items = [
    mainBlock(library, 'bench', 2, [['Top set', 1, 4, 7], ['Backdown', 3, 6, 6]]),
    makeAccItem('Hammer Curls'),
  ]
  const week = { days }
  return {
    sameEveryWeek: true,
    frequency: { squat: 2, bench: 2, deadlift: 1 },
    weeks: Array.from({ length: weekCount }, () => clone(week)),
  }
}

function runningSeries(endE1) {
  const points = []
  const anchor = parseISO(todayISO())
  for (let w = 9; w >= 0; w -= 1) {
    const date = isoFromDate(addDays(anchor, -7 * w))
    const t = (9 - w) / 9
    const point = { date }
    for (const lift of ['squat', 'bench', 'deadlift']) {
      const target = endE1[lift]
      point[lift] = roundPlate(target * 0.88 + (target - target * 0.88) * t)
    }
    points.push(point)
  }
  const last = points[points.length - 1]
  last.squat = endE1.squat
  last.bench = endE1.bench
  last.deadlift = endE1.deadlift
  return points
}

const DEMO_LOGS = [
  { daysAgo: 63, lift: 'squat', factor: 0.74, reps: 5, rpe: 8, exercise: '1° Comp Squat', label: 'Top set' },
  { daysAgo: 56, lift: 'bench', factor: 0.76, reps: 5, rpe: 8, exercise: '1° Comp Bench', label: 'Top set' },
  { daysAgo: 49, lift: 'deadlift', factor: 0.7, reps: 4, rpe: 7.5, exercise: '1° Comp Deadlift', label: 'Top set' },
  { daysAgo: 35, lift: 'squat', factor: 0.78, reps: 4, rpe: 8, exercise: '1° Comp Squat', label: 'Top set' },
  { daysAgo: 28, lift: 'bench', factor: 0.8, reps: 3, rpe: 8, exercise: '1° Comp Bench', label: 'Top set' },
  { daysAgo: 21, lift: 'deadlift', factor: 0.74, reps: 3, rpe: 8, exercise: '1° Comp Deadlift', label: 'Top set' },
  { daysAgo: 14, lift: 'squat', factor: 0.8, reps: 3, rpe: 8.5, exercise: '1° Comp Squat', label: 'Top set' },
  { daysAgo: 7, lift: 'bench', factor: 0.84, reps: 2, rpe: 8, exercise: '1° Comp Bench', label: 'Top set' },
]

function demoLogs(pbs) {
  return DEMO_LOGS.map((spec) => {
    const weight = roundPlate(pbs[spec.lift] * spec.factor)
    return {
      id: uid(),
      setKey: null,
      blockId: null,
      weekIndex: null,
      dayIndex: null,
      setNumber: 1,
      exercise: spec.exercise,
      label: spec.label,
      lift: spec.lift,
      weight,
      reps: spec.reps,
      rpe: spec.rpe,
      e1: e1FromSet(weight, spec.reps, spec.rpe),
      date: isoFromDate(addDays(parseISO(todayISO()), -spec.daysAgo)),
      videoId: null,
    }
  })
}

function logFromRow(row, blockId, weekIndex, dayIndex, date, videoId) {
  const weight = row.prescribedKg
  const reps = row.prescribedReps
  const rpe = row.prescribedRpe
  return {
    id: uid(),
    setKey: row.setKey,
    blockId,
    weekIndex,
    dayIndex,
    setNumber: row.setNumber,
    exercise: row.exercise,
    label: row.label,
    lift: row.lift,
    weight,
    reps,
    rpe,
    e1: row.lift ? e1FromSet(weight, reps, rpe) : null,
    date,
    videoId,
  }
}

function videoFromLog(log, blockName) {
  return {
    id: log.videoId,
    logId: log.id,
    date: log.date,
    blockId: log.blockId,
    blockName,
    weekIndex: log.weekIndex,
    dayIndex: log.dayIndex,
    setNumber: log.setNumber,
    exercise: log.exercise,
    label: log.label,
    lift: log.lift,
    reps: log.reps,
    weight: log.weight,
    rpe: log.rpe,
    url: null,
    type: '',
    name: '',
    caption: setCaption(log),
  }
}

function accessoryLibrary() {
  return DEFAULT_ACCESSORIES.map((name) => ({ id: uid(), name, group: 'custom' }))
}

function makeAthlete(partial) {
  const e1rm = partial.e1rm || partial.pbs
  return {
    planningMode: 'meet',
    blockWeeks: 16,
    accessoryLibrary: accessoryLibrary(),
    liftLibrary: defaultLiftLibrary(),
    startDate: mondayOf(todayISO()),
    scheduleOverrides: [],
    plans: {},
    logs: demoLogs(partial.pbs),
    videos: [],
    e1rm,
    e1rmSeries: runningSeries(e1rm),
    coachId: null,
    ...partial,
    e1rm: partial.e1rm || partial.pbs,
  }
}

export function createWorkspace() {
  // Codes are random unique IDs (not derived from names — names can collide).
  const coach = { ...COACH, code: makeCoachCode() }
  const ola = makeAthlete({
    id: 'ola',
    name: 'David Thomas',
    code: makeAthleteCode(),
    event: 'IPF Jr. Worlds',
    meetDate: '2027-01-07',
    coachId: coach.id,
    pbs: { squat: 200, bench: 130, deadlift: 265 },
    e1rm: { squat: 200, bench: 130, deadlift: 265 },
    blocks: [{ id: 'b1', name: 'Block 1', weeks: 4 }, { id: 'b2', name: 'Block 2', weeks: 4 }, { id: 'b3', name: 'Block 3', weeks: 3 }],
  })
  const marcus = makeAthlete({
    id: 'marcus',
    name: 'Marcus Chen',
    code: makeAthleteCode(),
    event: 'USAPL Nationals',
    meetDate: '2026-12-17',
    coachId: coach.id,
    pbs: { squat: 250, bench: 180, deadlift: 300 },
    e1rm: { squat: 250, bench: 180, deadlift: 300 },
    blocks: [{ id: 'b1', name: 'Block 1', weeks: 3 }, { id: 'b2', name: 'Block 2', weeks: 3 }, { id: 'b3', name: 'Block 3', weeks: 2 }],
  })
  const sofia = makeAthlete({
    id: 'sofia',
    name: 'Sofia Reyes',
    code: makeAthleteCode(),
    event: 'Off-season',
    meetDate: '2027-02-11',
    planningMode: 'block',
    coachId: null,
    pbs: { squat: 160, bench: 95, deadlift: 180 },
    e1rm: { squat: 160, bench: 95, deadlift: 180 },
    blocks: [{ id: 'b1', name: 'Block 1', weeks: 7 }, { id: 'b2', name: 'Block 2', weeks: 5 }, { id: 'b3', name: 'Block 3', weeks: 4 }],
  })

  const olaPlan = publishedPlan(ola.liftLibrary, 4)
  ola.plans = { b1: olaPlan }
  const mondayRows = expandDaySets(olaPlan.weeks[0].days[0], ola)
  const videoIds = [uid(), uid()]
  const planLogs = [mondayRows[0], mondayRows[1]].filter(Boolean).map((row, i) => (
    logFromRow(row, 'b1', 0, 0, ola.startDate, videoIds[i])
  ))
  ola.logs = [...planLogs, ...ola.logs]
  ola.videos = planLogs.map((log) => videoFromLog(log, 'Block 1'))

  marcus.plans = { b1: publishedPlan(marcus.liftLibrary, 3) }

  const messages = {
    ola: [
      { id: uid(), from: 'coach', text: 'Block 1 is up. Thursday deadlift is a top double at 8, then three back-off triples. Film each working set.', at: atDaysAgo(2, 8, 40), attachment: null, unread: false },
      { id: uid(), from: 'athlete', text: 'Monday squat felt fast. I’ll get the deadlift from the side.', at: atDaysAgo(2, 18, 5), attachment: null, unread: false },
      { id: uid(), from: 'coach', text: 'Side angle is the one I want. The caption should match whatever you actually logged.', at: atDaysAgo(1, 9, 12), attachment: null, unread: false },
      { id: uid(), from: 'athlete', text: 'On my way in. I’ll log the top set before the backdowns.', at: atDaysAgo(0, 7, 48), attachment: null, unread: true },
    ],
    marcus: [
      { id: uid(), from: 'coach', text: 'Bench stays competition grip. Send Tuesday’s top set when you have it.', at: atDaysAgo(3, 11, 5), attachment: null, unread: false },
      { id: uid(), from: 'athlete', text: 'Elbow was quiet. I’ll film set 1.', at: atDaysAgo(3, 16, 40), attachment: null, unread: false },
      { id: uid(), from: 'coach', text: 'If the bar speed dies, cut the backdowns and tell me in here.', at: atDaysAgo(1, 12, 15), attachment: null, unread: false },
    ],
    sofia: [],
  }

  return {
    coach,
    athletes: { ola, marcus, sofia },
    messages,
  }
}

export function findLog(logs, blockId, weekIndex, dayIndex, setKey) {
  return (logs || []).find((l) => l.blockId === blockId && l.weekIndex === weekIndex && l.dayIndex === dayIndex && l.setKey === setKey)
}

export function unreadCount(messages, athleteId, role) {
  return (messages[athleteId] || []).filter((m) => m.unread && m.from !== role).length
}
