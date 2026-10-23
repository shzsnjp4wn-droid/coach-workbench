/**
 * One-off seed: uploads createWorkspace() mock data into Supabase.
 *
 * Usage:
 *   1. Run supabase/schema.sql in the Supabase SQL editor
 *   2. Copy .env.example → .env and fill URL + keys
 *   3. npm run seed:supabase
 *
 * Uses the service role so it can clear and rewrite seed rows.
 * Does not touch React UI.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile(resolve(root, '.env'))
loadEnvFile(resolve(root, '.env.local'))

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL (or SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const { createWorkspace, makeAthleteCode, makeCoachCode } = await import(
  pathToFileURL(resolve(root, 'src/domain.js')).href
)

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** Same generate → check DB → retry loop the app uses (plus a local set for this batch). */
async function allocateUniqueCode(kind, taken) {
  const table = kind === 'coach' ? 'coaches' : 'athletes'
  const mint = kind === 'coach' ? makeCoachCode : makeAthleteCode
  for (let attempt = 1; attempt <= 16; attempt += 1) {
    const code = mint()
    if (taken.has(code)) continue
    const { data, error } = await supabase.from(table).select('id').eq('code', code).maybeSingle()
    if (error) {
      console.error(`✗ check ${kind} code`, error)
      process.exit(1)
    }
    if (!data) {
      taken.add(code)
      return code
    }
    console.warn(`  collision on ${code}, retrying…`)
  }
  console.error(`✗ could not allocate unique ${kind} code`)
  process.exit(1)
}

let workspace
let coach
let athletes

function assertOk(label, error) {
  if (error) {
    console.error(`✗ ${label}`, error)
    process.exit(1)
  }
  console.log(`✓ ${label}`)
}

async function deleteAll(table, column = 'id') {
  const { error } = await supabase.from(table).delete().neq(column, '__never__')
  assertOk(`wipe ${table}`, error)
}

async function wipe() {
  // Break circular video ↔ log FKs, then delete dependents → parents.
  {
    const { error } = await supabase.from('set_logs').update({ video_id: null }).neq('id', '__never__')
    assertOk('clear set_logs.video_id', error)
  }
  {
    const { error } = await supabase.from('videos').update({ log_id: null }).neq('id', '__never__')
    assertOk('clear videos.log_id', error)
  }

  await deleteAll('messages')
  await deleteAll('e1rm_series', 'athlete_id')
  await deleteAll('schedule_overrides', 'athlete_id')
  await deleteAll('set_logs')
  await deleteAll('videos')
  await deleteAll('plans', 'block_key')
  await deleteAll('blocks', 'block_key')
  await deleteAll('athletes')
  await deleteAll('coaches')
}

async function seed() {
  workspace = createWorkspace()
  const takenCodes = new Set()
  workspace.coach.code = await allocateUniqueCode('coach', takenCodes)
  for (const athlete of Object.values(workspace.athletes)) {
    athlete.code = await allocateUniqueCode('athlete', takenCodes)
  }
  coach = workspace.coach
  athletes = Object.values(workspace.athletes)

  {
    const { error } = await supabase.from('coaches').upsert({
      id: coach.id,
      name: coach.name,
      code: coach.code,
    })
    assertOk(`coaches (${coach.code})`, error)
  }

  const athleteRows = athletes.map((a) => ({
    id: a.id,
    name: a.name,
    code: a.code,
    coach_id: a.coachId || null,
    event: a.event,
    meet_date: a.meetDate,
    planning_mode: a.planningMode,
    block_weeks: a.blockWeeks,
    start_date: a.startDate,
    pbs: a.pbs,
    e1rm: a.e1rm,
    accessory_library: a.accessoryLibrary,
    lift_library: a.liftLibrary,
  }))
  {
    const { error } = await supabase.from('athletes').upsert(athleteRows)
    assertOk(`athletes (${athleteRows.length})`, error)
  }

  const blockRows = []
  const planRows = []
  for (const a of athletes) {
    a.blocks.forEach((b, position) => {
      blockRows.push({
        athlete_id: a.id,
        block_key: b.id,
        name: b.name,
        weeks: b.weeks,
        position,
      })
      const plan = a.plans?.[b.id]
      if (plan) {
        planRows.push({
          athlete_id: a.id,
          block_key: b.id,
          same_every_week: plan.sameEveryWeek,
          frequency: plan.frequency,
          weeks: plan.weeks,
        })
      }
    })
  }
  {
    const { error } = await supabase.from('blocks').upsert(blockRows)
    assertOk(`blocks (${blockRows.length})`, error)
  }
  if (planRows.length) {
    const { error } = await supabase.from('plans').upsert(planRows)
    assertOk(`plans (${planRows.length})`, error)
  } else {
    console.log('✓ plans (0)')
  }

  // Insert videos without log_id first (logs may reference video_id).
  const videoRows = []
  for (const a of athletes) {
    for (const v of a.videos || []) {
      videoRows.push({
        id: v.id,
        athlete_id: a.id,
        log_id: null,
        date: v.date,
        block_key: v.blockId,
        block_name: v.blockName,
        week_index: v.weekIndex,
        day_index: v.dayIndex,
        set_number: v.setNumber,
        exercise: v.exercise,
        label: v.label,
        lift: v.lift,
        reps: v.reps,
        weight: v.weight,
        rpe: v.rpe,
        url: v.url,
        type: v.type || '',
        name: v.name || '',
        caption: v.caption || '',
      })
    }
  }
  if (videoRows.length) {
    const { error } = await supabase.from('videos').upsert(videoRows)
    assertOk(`videos (${videoRows.length})`, error)
  } else {
    console.log('✓ videos (0)')
  }

  const logRows = []
  for (const a of athletes) {
    for (const log of a.logs || []) {
      logRows.push({
        id: log.id,
        athlete_id: a.id,
        set_key: log.setKey,
        block_key: log.blockId,
        week_index: log.weekIndex,
        day_index: log.dayIndex,
        set_number: log.setNumber,
        exercise: log.exercise,
        label: log.label,
        lift: log.lift,
        weight: log.weight,
        reps: log.reps,
        rpe: log.rpe,
        e1: log.e1,
        date: log.date,
        video_id: log.videoId,
      })
    }
  }
  if (logRows.length) {
    const { error } = await supabase.from('set_logs').upsert(logRows)
    assertOk(`set_logs (${logRows.length})`, error)
  } else {
    console.log('✓ set_logs (0)')
  }

  for (const a of athletes) {
    for (const v of a.videos || []) {
      if (!v.logId) continue
      const { error } = await supabase.from('videos').update({ log_id: v.logId }).eq('id', v.id)
      assertOk(`link video ${v.id} → log`, error)
    }
  }

  const seriesRows = []
  for (const a of athletes) {
    for (const point of a.e1rmSeries || []) {
      seriesRows.push({
        athlete_id: a.id,
        date: point.date,
        squat: point.squat,
        bench: point.bench,
        deadlift: point.deadlift,
      })
    }
  }
  if (seriesRows.length) {
    const { error } = await supabase.from('e1rm_series').upsert(seriesRows)
    assertOk(`e1rm_series (${seriesRows.length})`, error)
  } else {
    console.log('✓ e1rm_series (0)')
  }

  const overrideRows = []
  for (const a of athletes) {
    for (const o of a.scheduleOverrides || []) {
      overrideRows.push({
        athlete_id: a.id,
        block_key: o.blockId,
        week_index: o.weekIndex,
        day_index: o.dayIndex,
        prescribed_weekday: o.prescribedWeekday,
        actual_weekday: o.actualWeekday,
        date: o.date,
      })
    }
  }
  if (overrideRows.length) {
    const { error } = await supabase.from('schedule_overrides').upsert(overrideRows)
    assertOk(`schedule_overrides (${overrideRows.length})`, error)
  } else {
    console.log('✓ schedule_overrides (0)')
  }

  const messageRows = []
  for (const [athleteId, thread] of Object.entries(workspace.messages || {})) {
    for (const m of thread) {
      messageRows.push({
        id: m.id,
        athlete_id: athleteId,
        from_role: m.from,
        text: m.text || '',
        at: m.at,
        attachment: m.attachment,
        unread: Boolean(m.unread),
      })
    }
  }
  if (messageRows.length) {
    const { error } = await supabase.from('messages').upsert(messageRows)
    assertOk(`messages (${messageRows.length})`, error)
  } else {
    console.log('✓ messages (0)')
  }

  console.log('\nSeeded profiles (codes are random + unique — find people by name or paste the code):')
  console.log(`  - coach ${coach.name} (${coach.id}) code=${coach.code}`)
  for (const a of athletes) {
    console.log(`  - ${a.name} (${a.id}) code=${a.code} coach=${a.coachId || 'none'} blocks=${a.blocks.length} logs=${a.logs.length} videos=${a.videos.length}`)
  }
}

console.log('Seeding Supabase from createWorkspace() …')
console.log(`URL: ${url}`)
await wipe()
await seed()
console.log('\nDone. Open the app and search the directory by name, or use the codes printed above.')
