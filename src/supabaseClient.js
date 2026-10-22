import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to your .env file.',
  )
}

export const supabase = createClient(
  supabaseUrl || 'http://localhost',
  supabaseAnonKey || 'public-anon-key',
)

const MEDIA_BUCKET = 'media'

export function mapCoachRow(row) {
  if (!row) return null
  return { id: row.id, name: row.name, code: row.code }
}

export function mapAthleteProfile(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    coachId: row.coach_id ?? null,
    event: row.event || '',
    meetDate: row.meet_date,
    planningMode: row.planning_mode || 'meet',
    blockWeeks: row.block_weeks ?? 16,
    startDate: row.start_date,
    pbs: row.pbs || { squat: 0, bench: 0, deadlift: 0 },
    e1rm: row.e1rm || { squat: 0, bench: 0, deadlift: 0 },
    accessoryLibrary: row.accessory_library || [],
    liftLibrary: row.lift_library || {},
  }
}

function mapLogRow(row) {
  return {
    id: row.id,
    setKey: row.set_key,
    blockId: row.block_key,
    weekIndex: row.week_index,
    dayIndex: row.day_index,
    setNumber: row.set_number,
    exercise: row.exercise,
    label: row.label,
    lift: row.lift,
    weight: row.weight == null ? null : Number(row.weight),
    reps: row.reps == null ? null : Number(row.reps),
    rpe: row.rpe == null ? null : Number(row.rpe),
    e1: row.e1 == null ? null : Number(row.e1),
    date: row.date,
    videoId: row.video_id,
  }
}

function mapVideoRow(row) {
  return {
    id: row.id,
    logId: row.log_id,
    date: row.date,
    blockId: row.block_key,
    blockName: row.block_name,
    weekIndex: row.week_index,
    dayIndex: row.day_index,
    setNumber: row.set_number,
    exercise: row.exercise,
    label: row.label,
    lift: row.lift,
    reps: row.reps == null ? null : Number(row.reps),
    weight: row.weight == null ? null : Number(row.weight),
    rpe: row.rpe == null ? null : Number(row.rpe),
    url: row.url,
    type: row.type || '',
    name: row.name || '',
    caption: row.caption || '',
  }
}

function mapOverrideRow(row) {
  return {
    blockId: row.block_key,
    weekIndex: row.week_index,
    dayIndex: row.day_index,
    prescribedWeekday: row.prescribed_weekday,
    actualWeekday: row.actual_weekday,
    date: row.date,
  }
}

function mapMessageRow(row) {
  return {
    id: row.id,
    from: row.from_role,
    text: row.text || '',
    at: row.at,
    attachment: row.attachment,
    unread: Boolean(row.unread),
  }
}

function assertOk(error) {
  if (error) throw error
}

/** Load the full app workspace from Supabase (no mock data). */
export async function fetchWorkspace() {
  const [
    coachesRes,
    athletesRes,
    blocksRes,
    plansRes,
    logsRes,
    videosRes,
    seriesRes,
    overridesRes,
    messagesRes,
  ] = await Promise.all([
    supabase.from('coaches').select('id, name, code').order('name'),
    supabase.from('athletes').select('id, name, code, coach_id, event, meet_date, planning_mode, block_weeks, start_date, pbs, e1rm, accessory_library, lift_library').order('name'),
    supabase.from('blocks').select('athlete_id, block_key, name, weeks, position').order('position'),
    supabase.from('plans').select('athlete_id, block_key, same_every_week, frequency, weeks'),
    supabase.from('set_logs').select('*').order('date', { ascending: false }),
    supabase.from('videos').select('*').order('date', { ascending: false }),
    supabase.from('e1rm_series').select('*').order('date', { ascending: true }),
    supabase.from('schedule_overrides').select('*'),
    supabase.from('messages').select('*').order('at', { ascending: true }),
  ])

  for (const res of [coachesRes, athletesRes, blocksRes, plansRes, logsRes, videosRes, seriesRes, overridesRes, messagesRes]) {
    assertOk(res.error)
  }

  const coaches = (coachesRes.data || []).map(mapCoachRow)
  const profiles = (athletesRes.data || []).map(mapAthleteProfile)
  const blocks = blocksRes.data || []
  const plans = plansRes.data || []
  const logs = logsRes.data || []
  const videos = videosRes.data || []
  const series = seriesRes.data || []
  const overrides = overridesRes.data || []
  const messageRows = messagesRes.data || []

  const athletes = {}
  for (const profile of profiles) {
    const athleteBlocks = blocks
      .filter((b) => b.athlete_id === profile.id)
      .sort((a, b) => a.position - b.position)
      .map((b) => ({ id: b.block_key, name: b.name, weeks: b.weeks }))

    const athletePlans = {}
    for (const p of plans.filter((row) => row.athlete_id === profile.id)) {
      athletePlans[p.block_key] = {
        sameEveryWeek: p.same_every_week,
        frequency: p.frequency || { squat: 2, bench: 2, deadlift: 1 },
        weeks: p.weeks || [],
      }
    }

    athletes[profile.id] = {
      ...profile,
      blocks: athleteBlocks,
      plans: athletePlans,
      logs: logs.filter((row) => row.athlete_id === profile.id).map(mapLogRow),
      videos: videos.filter((row) => row.athlete_id === profile.id).map(mapVideoRow),
      e1rmSeries: series
        .filter((row) => row.athlete_id === profile.id)
        .map((row) => ({
          date: row.date,
          squat: row.squat == null ? null : Number(row.squat),
          bench: row.bench == null ? null : Number(row.bench),
          deadlift: row.deadlift == null ? null : Number(row.deadlift),
        })),
      scheduleOverrides: overrides
        .filter((row) => row.athlete_id === profile.id)
        .map(mapOverrideRow),
    }
  }

  const messages = {}
  for (const id of Object.keys(athletes)) messages[id] = []
  for (const row of messageRows) {
    if (!messages[row.athlete_id]) messages[row.athlete_id] = []
    messages[row.athlete_id].push(mapMessageRow(row))
  }

  return { coaches, athletes, messages }
}

export async function updateAthleteCoachId(athleteId, coachId) {
  const { data, error } = await supabase
    .from('athletes')
    .update({ coach_id: coachId, updated_at: new Date().toISOString() })
    .eq('id', athleteId)
    .select('id, coach_id')
    .single()
  assertOk(error)
  return data
}

export async function upsertAthleteProfile(athlete) {
  const { error } = await supabase.from('athletes').upsert({
    id: athlete.id,
    name: athlete.name,
    code: athlete.code,
    coach_id: athlete.coachId,
    event: athlete.event,
    meet_date: athlete.meetDate,
    planning_mode: athlete.planningMode,
    block_weeks: athlete.blockWeeks,
    start_date: athlete.startDate,
    pbs: athlete.pbs,
    e1rm: athlete.e1rm,
    accessory_library: athlete.accessoryLibrary,
    lift_library: athlete.liftLibrary,
    updated_at: new Date().toISOString(),
  })
  assertOk(error)
}

export async function syncBlocks(athleteId, blocks) {
  const { data: existing, error: readError } = await supabase
    .from('blocks')
    .select('block_key')
    .eq('athlete_id', athleteId)
  assertOk(readError)

  const nextKeys = new Set(blocks.map((b) => b.id))
  const toDelete = (existing || []).map((r) => r.block_key).filter((key) => !nextKeys.has(key))
  if (toDelete.length) {
    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('athlete_id', athleteId)
      .in('block_key', toDelete)
    assertOk(error)
  }

  if (!blocks.length) return
  const rows = blocks.map((b, position) => ({
    athlete_id: athleteId,
    block_key: b.id,
    name: b.name,
    weeks: b.weeks,
    position,
  }))
  const { error } = await supabase.from('blocks').upsert(rows)
  assertOk(error)
}

export async function upsertPlan(athleteId, blockKey, plan) {
  const { error } = await supabase.from('plans').upsert({
    athlete_id: athleteId,
    block_key: blockKey,
    same_every_week: plan.sameEveryWeek,
    frequency: plan.frequency,
    weeks: plan.weeks,
    updated_at: new Date().toISOString(),
  })
  assertOk(error)
}

export async function upsertSetLog(athleteId, log) {
  const { error } = await supabase.from('set_logs').upsert({
    id: log.id,
    athlete_id: athleteId,
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
  assertOk(error)
}

export async function upsertVideo(athleteId, video) {
  const { error } = await supabase.from('videos').upsert({
    id: video.id,
    athlete_id: athleteId,
    log_id: video.logId,
    date: video.date,
    block_key: video.blockId,
    block_name: video.blockName,
    week_index: video.weekIndex,
    day_index: video.dayIndex,
    set_number: video.setNumber,
    exercise: video.exercise,
    label: video.label,
    lift: video.lift,
    reps: video.reps,
    weight: video.weight,
    rpe: video.rpe,
    url: video.url,
    type: video.type || '',
    name: video.name || '',
    caption: video.caption || '',
  })
  assertOk(error)
}

export async function upsertE1rmPoint(athleteId, point) {
  const { error } = await supabase.from('e1rm_series').upsert({
    athlete_id: athleteId,
    date: point.date,
    squat: point.squat,
    bench: point.bench,
    deadlift: point.deadlift,
  })
  assertOk(error)
}

export async function upsertScheduleOverride(athleteId, override) {
  const { error } = await supabase.from('schedule_overrides').upsert({
    athlete_id: athleteId,
    block_key: override.blockId,
    week_index: override.weekIndex,
    day_index: override.dayIndex,
    prescribed_weekday: override.prescribedWeekday,
    actual_weekday: override.actualWeekday,
    date: override.date,
  }, { onConflict: 'athlete_id,block_key,week_index,day_index' })
  assertOk(error)
}

export async function insertMessage(athleteId, message) {
  const { error } = await supabase.from('messages').insert({
    id: message.id,
    athlete_id: athleteId,
    from_role: message.from,
    text: message.text || '',
    at: message.at,
    attachment: message.attachment,
    unread: Boolean(message.unread),
  })
  assertOk(error)
}

export async function markMessagesRead(athleteId, readerRole) {
  const { error } = await supabase
    .from('messages')
    .update({ unread: false })
    .eq('athlete_id', athleteId)
    .eq('unread', true)
    .neq('from_role', readerRole)
  assertOk(error)
}

/**
 * Upload a browser media object (from fileToMedia) to Storage.
 * Returns a public URL, or null if storage isn't configured yet.
 */
export async function uploadMedia(athleteId, objectId, media) {
  if (!media?.url) return null
  try {
    const blob = await fetch(media.url).then((r) => r.blob())
    const ext = (media.name && media.name.includes('.'))
      ? media.name.split('.').pop()
      : (blob.type.split('/')[1] || 'bin')
    const path = `${athleteId}/${objectId}.${ext}`
    const { error: upError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, blob, { upsert: true, contentType: media.type || blob.type || 'application/octet-stream' })
    if (upError) {
      console.warn('[supabase] media upload skipped:', upError.message)
      return null
    }
    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)
    return data?.publicUrl || null
  } catch (err) {
    console.warn('[supabase] media upload failed', err)
    return null
  }
}

/** Persist profile fields + block list for an athlete. */
export async function persistAthleteStructure(athlete) {
  await upsertAthleteProfile(athlete)
  await syncBlocks(athlete.id, athlete.blocks || [])
}

/** Persist one plan document. */
export async function persistPlan(athleteId, blockKey, plan) {
  await upsertPlan(athleteId, blockKey, plan)
}
