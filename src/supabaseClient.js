import { createClient } from '@supabase/supabase-js'
import { makeAthleteCode, makeCoachCode } from './domain'

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
  {
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'pkce',
    },
  },
)

const MEDIA_BUCKET = 'media'
const RESUMABLE_THRESHOLD = 5 * 1024 * 1024

/** Canonical app origin for Auth email redirects (Site URL / redirect allow-list). */
export function getAppOrigin() {
  const fromEnv = (import.meta.env.VITE_APP_URL || '').replace(/\/$/, '')
  if (fromEnv) return fromEnv
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return 'http://localhost:5173'
}

export function getAuthRedirectTo(path = '/') {
  const origin = getAppOrigin()
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${origin}${clean}`
}

/**
 * Consume Auth confirmation / magic-link callbacks from the URL.
 * Fixes dead redirects that pointed at localhost:3000 by finishing the session
 * exchange on the current app origin, then cleaning the address bar.
 */
export async function consumeAuthRedirect() {
  if (typeof window === 'undefined') return { kind: 'none' }

  const href = window.location.href
  const search = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

  const error = search.get('error_description') || hashParams.get('error_description')
    || search.get('error') || hashParams.get('error')
  if (error) {
    const cleaned = `${window.location.origin}${window.location.pathname}`
    window.history.replaceState({}, document.title, cleaned)
    return { kind: 'error', message: decodeURIComponent(error.replace(/\+/g, ' ')) }
  }

  // PKCE / code flow (?code=…)
  if (search.get('code')) {
    const { data, error: exErr } = await supabase.auth.exchangeCodeForSession(href)
    const cleaned = `${window.location.origin}${window.location.pathname}`
    window.history.replaceState({}, document.title, cleaned)
    if (exErr) return { kind: 'error', message: exErr.message }
    return { kind: 'confirmed', session: data.session, email: data.session?.user?.email || null }
  }

  // Implicit hash tokens (#access_token=…&type=signup)
  const accessToken = hashParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token')
  const type = hashParams.get('type')
  if (accessToken && refreshToken) {
    const { data, error: setErr } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    const cleaned = `${window.location.origin}${window.location.pathname}`
    window.history.replaceState({}, document.title, cleaned)
    if (setErr) return { kind: 'error', message: setErr.message }
    return {
      kind: type === 'signup' || type === 'email' ? 'confirmed' : 'session',
      session: data.session,
      email: data.session?.user?.email || null,
    }
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user?.email) {
    return { kind: 'session', session, email: session.user.email }
  }
  return { kind: 'none' }
}

export function mapCoachRow(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    email: row.email || null,
    emailVerified: Boolean(row.email_verified),
  }
}

export function mapAthleteProfile(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    email: row.email || null,
    emailVerified: Boolean(row.email_verified),
    coachId: row.coach_id ?? null,
    sex: row.sex === 'female' ? 'female' : 'male',
    bodyweightKg: row.bodyweight_kg == null ? null : Number(row.bodyweight_kg),
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

export function mapStintRow(row) {
  if (!row) return null
  return {
    id: row.id,
    athleteId: row.athlete_id,
    coachId: row.coach_id,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    startBodyweightKg: row.start_bodyweight_kg == null ? null : Number(row.start_bodyweight_kg),
    startTotalKg: row.start_total_kg == null ? null : Number(row.start_total_kg),
    startDots: row.start_dots == null ? null : Number(row.start_dots),
    endTotalKg: row.end_total_kg == null ? null : Number(row.end_total_kg),
    endDots: row.end_dots == null ? null : Number(row.end_dots),
    transferHistory: Boolean(row.transfer_history),
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
    coachId: row.coach_id ?? null,
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
    coachId: row.coach_id ?? null,
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
    coachId: row.coach_id ?? null,
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
    coachId: row.coach_id ?? null,
  }
}

export function formatSupabaseError(error, label = 'Supabase') {
  if (!error) return `${label} failed`
  const parts = [
    error.message,
    error.code ? `code=${error.code}` : null,
    error.details ? `details=${error.details}` : null,
    error.hint ? `hint=${error.hint}` : null,
  ].filter(Boolean)
  return `${label}: ${parts.join(' · ')}`
}

function assertOk(error, label) {
  if (error) {
    const err = new Error(formatSupabaseError(error, label))
    err.cause = error
    throw err
  }
}

function assertWrote(data, label) {
  if (data == null || (Array.isArray(data) && data.length === 0)) {
    throw new Error(
      `${label}: write returned no rows. Likely RLS/grants blocking anon writes — re-run supabase/grants.sql.`,
    )
  }
  return data
}

function requireCoachId(coachId, label) {
  if (!coachId) throw new Error(`${label}: active coach_id is required`)
  return coachId
}

function isMissingColumnError(error) {
  const msg = error?.message || ''
  return /column|does not exist|schema cache/i.test(msg)
}

async function selectOrFallback(label, primary, fallback) {
  const first = await primary()
  if (!first.error) return first
  if (fallback && isMissingColumnError(first.error)) {
    console.warn(`[supabase] ${label} schema lag — falling back. Run supabase/migration_coaching_units.sql`, first.error.message)
    return fallback()
  }
  return first
}

/** Load the full app workspace from Supabase (no domain.js mock merge). */
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
    stintsRes,
  ] = await Promise.all([
    selectOrFallback(
      'coaches',
      () => supabase.from('coaches').select('id, name, code, email, email_verified').order('name'),
      () => supabase.from('coaches').select('id, name, code').order('name'),
    ),
    selectOrFallback(
      'athletes',
      () => supabase.from('athletes').select('id, name, code, email, email_verified, coach_id, sex, bodyweight_kg, event, meet_date, planning_mode, block_weeks, start_date, pbs, e1rm, accessory_library, lift_library').order('name'),
      () => supabase.from('athletes').select('id, name, code, coach_id, event, meet_date, planning_mode, block_weeks, start_date, pbs, e1rm, accessory_library, lift_library').order('name'),
    ),
    selectOrFallback(
      'blocks',
      () => supabase.from('blocks').select('athlete_id, coach_id, block_key, name, weeks, position').order('position'),
      () => supabase.from('blocks').select('athlete_id, block_key, name, weeks, position').order('position'),
    ),
    selectOrFallback(
      'plans',
      () => supabase.from('plans').select('athlete_id, coach_id, block_key, same_every_week, frequency, weeks'),
      () => supabase.from('plans').select('athlete_id, block_key, same_every_week, frequency, weeks'),
    ),
    supabase.from('set_logs').select('*').order('date', { ascending: false }),
    supabase.from('videos').select('*').order('date', { ascending: false }),
    supabase.from('e1rm_series').select('*').order('date', { ascending: true }),
    supabase.from('schedule_overrides').select('*'),
    supabase.from('messages').select('*').order('at', { ascending: true }),
    supabase.from('coaching_stints').select('*').order('started_at', { ascending: false }),
  ])

  for (const [label, res] of [
    ['coaches', coachesRes],
    ['athletes', athletesRes],
    ['blocks', blocksRes],
    ['plans', plansRes],
    ['set_logs', logsRes],
    ['videos', videosRes],
    ['e1rm_series', seriesRes],
    ['schedule_overrides', overridesRes],
    ['messages', messagesRes],
    ['coaching_stints', stintsRes],
  ]) {
    if (label === 'coaching_stints' && res.error) {
      console.warn('[supabase] coaching_stints missing — run supabase/migration_coaching_units.sql', res.error.message)
      continue
    }
    assertOk(res.error, `load ${label}`)
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
  const stints = ((stintsRes.error ? [] : stintsRes.data) || []).map(mapStintRow)

  const athletes = {}
  for (const profile of profiles) {
    const athleteBlocks = blocks
      .filter((b) => b.athlete_id === profile.id)
      .sort((a, b) => a.position - b.position)
      .map((b) => ({ id: b.block_key, name: b.name, weeks: b.weeks, coachId: b.coach_id ?? null }))

    const athletePlans = {}
    for (const p of plans.filter((row) => row.athlete_id === profile.id)) {
      athletePlans[p.block_key] = {
        sameEveryWeek: Boolean(p.same_every_week),
        frequency: p.frequency || { squat: 2, bench: 2, deadlift: 1 },
        weeks: Array.isArray(p.weeks) ? p.weeks : [],
        coachId: p.coach_id ?? null,
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
          coachId: row.coach_id ?? null,
        })),
      scheduleOverrides: overrides
        .filter((row) => row.athlete_id === profile.id)
        .map(mapOverrideRow),
      stints: stints.filter((s) => s.athleteId === profile.id),
      activeStint: stints.find((s) => s.athleteId === profile.id && s.status === 'active') || null,
    }
  }

  const messages = {}
  for (const id of Object.keys(athletes)) messages[id] = []
  for (const row of messageRows) {
    if (!messages[row.athlete_id]) messages[row.athlete_id] = []
    messages[row.athlete_id].push(mapMessageRow(row))
  }

  return { coaches, athletes, messages, stints }
}

export async function updateAthleteCoachId(athleteId, coachId) {
  const { data, error } = await supabase
    .from('athletes')
    .update({ coach_id: coachId, updated_at: new Date().toISOString() })
    .eq('id', athleteId)
    .select('id, coach_id')
    .single()
  assertOk(error, 'update athlete coach_id')
  return assertWrote(data, 'update athlete coach_id')
}

export async function upsertAthleteProfile(athlete) {
  const base = {
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
  }
  const withGl = {
    ...base,
    sex: athlete.sex === 'female' ? 'female' : 'male',
    bodyweight_kg: athlete.bodyweightKg ?? null,
    email: athlete.email || null,
    email_verified: Boolean(athlete.emailVerified),
  }
  let { data, error } = await supabase.from('athletes').upsert(withGl, { onConflict: 'id' }).select('id')
  if (error && isMissingColumnError(error)) {
    console.warn('[supabase] athletes schema lag — run migrations')
    const fallback = { ...base }
    if (athlete.sex) fallback.sex = athlete.sex === 'female' ? 'female' : 'male'
    if (athlete.bodyweightKg != null) fallback.bodyweight_kg = athlete.bodyweightKg
    ;({ data, error } = await supabase.from('athletes').upsert(fallback, { onConflict: 'id' }).select('id'))
    if (error && isMissingColumnError(error)) {
      ;({ data, error } = await supabase.from('athletes').upsert(base, { onConflict: 'id' }).select('id'))
    }
  }
  assertOk(error, 'upsert athlete')
  assertWrote(data, 'upsert athlete')
}

export async function syncBlocks(athleteId, blocks, coachId) {
  const cid = requireCoachId(coachId, 'sync blocks')
  const { data: existing, error: readError } = await supabase
    .from('blocks')
    .select('block_key')
    .eq('athlete_id', athleteId)
    .eq('coach_id', cid)
  assertOk(readError, 'read blocks')

  if (!blocks.length) {
    if ((existing || []).length) {
      throw new Error('sync blocks: refusing to delete all blocks from an empty payload')
    }
    return
  }

  const nextKeys = new Set(blocks.map((b) => b.id))
  const toDelete = (existing || []).map((r) => r.block_key).filter((key) => !nextKeys.has(key))
  if (toDelete.length) {
    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('athlete_id', athleteId)
      .eq('coach_id', cid)
      .in('block_key', toDelete)
    assertOk(error, 'delete blocks')
  }

  const rows = blocks.map((b, position) => ({
    athlete_id: athleteId,
    coach_id: cid,
    block_key: b.id,
    name: b.name,
    weeks: b.weeks,
    position,
  }))
  const { data, error } = await supabase
    .from('blocks')
    .upsert(rows, { onConflict: 'athlete_id,coach_id,block_key' })
    .select('block_key')
  assertOk(error, 'upsert blocks')
  assertWrote(data, 'upsert blocks')
}

export async function upsertPlan(athleteId, blockKey, plan, coachId) {
  const cid = requireCoachId(coachId || plan.coachId, 'upsert plan')
  const { data, error } = await supabase
    .from('plans')
    .upsert({
      athlete_id: athleteId,
      coach_id: cid,
      block_key: blockKey,
      same_every_week: plan.sameEveryWeek,
      frequency: plan.frequency,
      weeks: plan.weeks,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'athlete_id,coach_id,block_key' })
    .select('block_key')
  assertOk(error, 'upsert plan')
  assertWrote(data, 'upsert plan')
}

export async function upsertSetLog(athleteId, log, coachId) {
  const cid = requireCoachId(coachId || log.coachId, 'upsert set_log')
  const { data, error } = await supabase
    .from('set_logs')
    .upsert({
      id: log.id,
      athlete_id: athleteId,
      coach_id: cid,
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
    }, { onConflict: 'id' })
    .select('id')
  assertOk(error, 'upsert set_log')
  assertWrote(data, 'upsert set_log')
}

export async function upsertVideo(athleteId, video, coachId) {
  const cid = requireCoachId(coachId || video.coachId, 'upsert video')
  if (video.url && String(video.url).startsWith('blob:')) {
    throw new Error('upsert video: refusing to save a temporary blob URL — upload to Storage first')
  }
  const { data, error } = await supabase
    .from('videos')
    .upsert({
      id: video.id,
      athlete_id: athleteId,
      coach_id: cid,
      log_id: video.logId || null,
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
      url: video.url || null,
      type: video.type || '',
      name: video.name || '',
      caption: video.caption || '',
    }, { onConflict: 'id' })
    .select('id, url')
  assertOk(error, 'upsert video')
  assertWrote(data, 'upsert video')
  if (video.url && data?.[0] && !data[0].url) {
    throw new Error('upsert video: row saved without url — check grants/RLS on public.videos')
  }
  return data[0]
}

export async function upsertE1rmPoint(athleteId, point, coachId) {
  const cid = requireCoachId(coachId || point.coachId, 'upsert e1rm_series')
  const { data, error } = await supabase
    .from('e1rm_series')
    .upsert({
      athlete_id: athleteId,
      coach_id: cid,
      date: point.date,
      squat: point.squat,
      bench: point.bench,
      deadlift: point.deadlift,
    }, { onConflict: 'athlete_id,coach_id,date' })
    .select('date')
  assertOk(error, 'upsert e1rm_series')
  assertWrote(data, 'upsert e1rm_series')
}

export async function upsertScheduleOverride(athleteId, override, coachId) {
  const cid = requireCoachId(coachId || override.coachId, 'upsert schedule_override')
  const { data, error } = await supabase
    .from('schedule_overrides')
    .upsert({
      athlete_id: athleteId,
      coach_id: cid,
      block_key: override.blockId,
      week_index: override.weekIndex,
      day_index: override.dayIndex,
      prescribed_weekday: override.prescribedWeekday,
      actual_weekday: override.actualWeekday,
      date: override.date,
    }, { onConflict: 'athlete_id,coach_id,block_key,week_index,day_index' })
    .select('block_key')
  assertOk(error, 'upsert schedule_override')
  assertWrote(data, 'upsert schedule_override')
}

export async function insertMessage(athleteId, message, coachId) {
  const cid = requireCoachId(coachId || message.coachId, 'insert message')
  const { data, error } = await supabase
    .from('messages')
    .insert({
      id: message.id,
      athlete_id: athleteId,
      coach_id: cid,
      from_role: message.from,
      text: message.text || '',
      at: message.at,
      attachment: message.attachment,
      unread: Boolean(message.unread),
    })
    .select('id')
  assertOk(error, 'insert message')
  assertWrote(data, 'insert message')
}

export async function markMessagesRead(athleteId, readerRole, coachId) {
  let q = supabase
    .from('messages')
    .update({ unread: false })
    .eq('athlete_id', athleteId)
    .eq('unread', true)
    .neq('from_role', readerRole)
  if (coachId) q = q.eq('coach_id', coachId)
  const { error } = await q.select('id')
  assertOk(error, 'mark messages read')
}

function encodeTusMetadata(value) {
  // TUS metadata values must be base64; browsers use btoa, Node uses Buffer.
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(value)))
  return Buffer.from(value, 'utf8').toString('base64')
}

async function uploadViaResumable(path, blob, contentType) {
  const endpoint = `${supabaseUrl}/storage/v1/upload/resumable`
  // Supabase Storage TUS requires 6 MiB chunks (except the final chunk).
  const chunkSize = 6 * 1024 * 1024
  let offset = 0

  // Create the resumable upload session (TUS 1.0).
  // Without Tus-Resumable the API returns 412 and phone-sized clips never land.
  const create = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
      'Tus-Resumable': '1.0.0',
      'x-upsert': 'true',
      'Upload-Length': String(blob.size),
      'Upload-Metadata': [
        `bucketName ${encodeTusMetadata(MEDIA_BUCKET)}`,
        `objectName ${encodeTusMetadata(path)}`,
        `contentType ${encodeTusMetadata(contentType)}`,
        `cacheControl ${encodeTusMetadata('3600')}`,
      ].join(','),
    },
  })
  if (!create.ok && create.status !== 201) {
    const detail = await create.text()
    throw new Error(`resumable create failed (${create.status}): ${detail}`)
  }
  let uploadUrl = create.headers.get('Location')
  if (!uploadUrl) throw new Error('resumable create: missing Location header')
  if (uploadUrl.startsWith('/')) {
    uploadUrl = `${supabaseUrl.replace(/\/$/, '')}${uploadUrl}`
  } else if (!/^https?:\/\//i.test(uploadUrl)) {
    uploadUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/upload/resumable/${uploadUrl}`
  }

  while (offset < blob.size) {
    const end = Math.min(offset + chunkSize, blob.size)
    const chunk = blob.slice(offset, end)
    const patch = await fetch(uploadUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
        'Tus-Resumable': '1.0.0',
        'Content-Type': 'application/offset+octet-stream',
        'Upload-Offset': String(offset),
        'Content-Length': String(chunk.size),
      },
      body: chunk,
    })
    if (!patch.ok && patch.status !== 204) {
      const detail = await patch.text()
      throw new Error(`resumable patch failed at ${offset} (${patch.status}): ${detail}`)
    }
    const next = patch.headers.get('Upload-Offset')
    offset = next != null ? Number(next) : end
  }
}

export async function uploadMedia(athleteId, objectId, media) {
  let blob = media?.file instanceof Blob ? media.file : null
  if (!blob && media?.url) {
    try {
      blob = await fetch(media.url).then((r) => r.blob())
    } catch (err) {
      throw new Error(`upload media: could not read file (${err?.message || err})`)
    }
  }
  if (!blob) throw new Error('upload media: missing local file — re-attach the clip and try again')

  const contentType = media.type || blob.type || 'application/octet-stream'
  const ext = (media.name && media.name.includes('.'))
    ? media.name.split('.').pop()
    : (contentType.split('/')[1] || 'bin')
  const path = `${athleteId}/${objectId}.${ext}`

  try {
    if (blob.size >= RESUMABLE_THRESHOLD) {
      await uploadViaResumable(path, blob, contentType)
    } else {
      const { error: upError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, blob, {
          upsert: true,
          contentType,
          cacheControl: '3600',
        })
      if (upError) throw upError
    }
  } catch (err) {
    throw new Error(
      formatSupabaseError(err, 'upload media')
      + ' — check supabase/storage.sql and that the media bucket allows anon uploads.',
    )
  }

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('upload media: no public URL returned')

  // Confirm the object is actually readable before we treat the clip as durable.
  try {
    const head = await fetch(data.publicUrl, { method: 'HEAD' })
    if (!head.ok) {
      throw new Error(`upload media: public URL not reachable (HTTP ${head.status})`)
    }
  } catch (err) {
    if (err?.message?.startsWith('upload media:')) throw err
    // Some environments block HEAD; fall through with the public URL.
    console.warn('[supabase] could not HEAD public media URL', err)
  }

  return data.publicUrl
}

export async function allocateUniqueUserCode(kind, { maxAttempts = 16 } = {}) {
  const table = kind === 'coach' ? 'coaches' : 'athletes'
  const mint = kind === 'coach' ? makeCoachCode : makeAthleteCode
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const code = mint()
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .eq('code', code)
      .maybeSingle()
    assertOk(error, `check ${kind} code uniqueness`)
    if (!data) return code
    console.warn(`[supabase] ${kind} code collision on attempt ${attempt}: ${code}`)
  }
  throw new Error(
    `Could not allocate a unique ${kind} code after ${maxAttempts} attempts`,
  )
}

export async function insertCoach(coach) {
  const row = {
    id: coach.id,
    name: coach.name,
    code: coach.code,
    email: coach.email || null,
    email_verified: Boolean(coach.emailVerified),
  }
  let { data, error } = await supabase.from('coaches').insert(row).select('id, name, code, email, email_verified')
  if (error && isMissingColumnError(error)) {
    ;({ data, error } = await supabase
      .from('coaches')
      .insert({ id: coach.id, name: coach.name, code: coach.code })
      .select('id, name, code'))
  }
  assertOk(error, 'insert coach')
  assertWrote(data, 'insert coach')
  return mapCoachRow(data[0])
}

function mintEmailCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/**
 * App-owned 6-digit signup codes (no Auth magic links).
 * Magic-link emails redirected to localhost and broke signup — we only use typed codes.
 * Optionally invokes the send-signup-code Edge Function to email the digits.
 */
export async function requestEmailVerification({ email, role, payload = {} }) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized || !normalized.includes('@')) {
    throw new Error('Enter a valid email address')
  }
  const table = role === 'coach' ? 'coaches' : 'athletes'
  const { data: existing, error: existErr } = await supabase
    .from(table)
    .select('id')
    .ilike('email', normalized)
    .maybeSingle()
  if (existErr && !isMissingColumnError(existErr)) assertOk(existErr, 'check email')
  if (existing) throw new Error('An account already uses that email')

  const code = mintEmailCode()
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const { error: insertErr } = await supabase.from('email_verifications').insert({
    email: normalized,
    code,
    role,
    payload,
    expires_at: expires,
  })
  if (insertErr) {
    if (isMissingColumnError(insertErr) || /email_verifications|schema cache/i.test(insertErr.message || '')) {
      throw new Error('Email verification is not set up — run supabase/migration_accounts.sql')
    }
    assertOk(insertErr, 'store verification code')
  }

  let emailed = false
  try {
    const { data, error: fnErr } = await supabase.functions.invoke('send-signup-code', {
      body: { email: normalized, code, role },
    })
    if (!fnErr && data?.ok) emailed = true
    else if (fnErr) console.warn('[supabase] send-signup-code', fnErr.message || fnErr)
  } catch (err) {
    console.warn('[supabase] send-signup-code invoke failed', err?.message || err)
  }

  return {
    email: normalized,
    delivered: emailed,
    // Always return the code so the UI can accept typed input even if email fails.
    code,
  }
}

export async function confirmEmailVerification({ email, code, role }) {
  const normalized = String(email || '').trim().toLowerCase()
  const token = String(code || '').trim()
  if (!normalized || !token) throw new Error('Email and code are required')

  const { data: rows, error } = await supabase
    .from('email_verifications')
    .select('*')
    .eq('email', normalized)
    .eq('role', role)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(5)
  if (error && !isMissingColumnError(error)) assertOk(error, 'load verification')

  const match = (rows || []).find((r) => r.code === token)
  if (!match) throw new Error('Invalid or expired code')

  await supabase
    .from('email_verifications')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', match.id)
  return { email: normalized, payload: match.payload || {}, via: 'app' }
}

function mapConnectionRequest(row) {
  if (!row) return null
  return {
    id: row.id,
    athleteId: row.athlete_id,
    coachId: row.coach_id,
    initiatedBy: row.initiated_by,
    status: row.status,
    transferHistory: Boolean(row.transfer_history),
    createdAt: row.created_at,
    respondedAt: row.responded_at,
  }
}

export async function fetchConnectionRequests() {
  const { data, error } = await supabase
    .from('connection_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) {
    if (isMissingColumnError(error) || /connection_requests|schema cache/i.test(error.message || '')) {
      console.warn('[supabase] connection_requests missing — run migration_connection_requests.sql')
      return []
    }
    assertOk(error, 'load connection requests')
  }
  return (data || []).map(mapConnectionRequest)
}

/** Either party proposes a link; the other must accept before a stint is created. */
export async function createConnectionRequest({
  athleteId,
  coachId,
  initiatedBy,
  transferHistory = false,
}) {
  if (!athleteId || !coachId) throw new Error('athlete and coach are required')
  if (initiatedBy !== 'athlete' && initiatedBy !== 'coach') {
    throw new Error('initiatedBy must be athlete or coach')
  }

  const { data: athlete, error: athErr } = await supabase
    .from('athletes')
    .select('id, coach_id')
    .eq('id', athleteId)
    .maybeSingle()
  assertOk(athErr, 'load athlete for connect')
  if (!athlete) throw new Error('Athlete not found')
  if (athlete.coach_id && athlete.coach_id !== coachId) {
    throw new Error('Athlete is already connected to another coach — disconnect first')
  }
  if (athlete.coach_id === coachId) {
    throw new Error('Already connected')
  }

  const { data: existing, error: exErr } = await supabase
    .from('connection_requests')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('coach_id', coachId)
    .eq('status', 'pending')
    .maybeSingle()
  assertOk(exErr, 'check pending connection')
  if (existing) return mapConnectionRequest(existing)

  const { data, error } = await supabase
    .from('connection_requests')
    .insert({
      athlete_id: athleteId,
      coach_id: coachId,
      initiated_by: initiatedBy,
      status: 'pending',
      transfer_history: Boolean(transferHistory),
    })
    .select('*')
  assertOk(error, 'create connection request')
  assertWrote(data, 'create connection request')
  return mapConnectionRequest(data[0])
}

export async function respondConnectionRequest(requestId, decision) {
  if (decision !== 'accepted' && decision !== 'declined') {
    throw new Error('decision must be accepted or declined')
  }
  const { data: row, error: findErr } = await supabase
    .from('connection_requests')
    .select('*')
    .eq('id', requestId)
    .eq('status', 'pending')
    .maybeSingle()
  assertOk(findErr, 'load connection request')
  if (!row) throw new Error('Request not found or already handled')

  const { data, error } = await supabase
    .from('connection_requests')
    .update({
      status: decision,
      responded_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select('*')
    .single()
  assertOk(error, 'respond connection request')
  return mapConnectionRequest(data)
}

export async function cancelConnectionRequest(requestId) {
  const { data, error } = await supabase
    .from('connection_requests')
    .update({
      status: 'cancelled',
      responded_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('*')
    .single()
  assertOk(error, 'cancel connection request')
  return mapConnectionRequest(data)
}

export async function deleteAccount({ role, id }) {
  if (!id) throw new Error('Missing account id')
  if (role === 'coach') {
    await supabase.from('athletes').update({ coach_id: null }).eq('coach_id', id)
    await supabase.from('coaching_stints').delete().eq('coach_id', id)
    await supabase.from('messages').delete().eq('coach_id', id)
    await supabase.from('set_logs').delete().eq('coach_id', id)
    await supabase.from('videos').delete().eq('coach_id', id)
    await supabase.from('e1rm_series').delete().eq('coach_id', id)
    await supabase.from('schedule_overrides').delete().eq('coach_id', id)
    await supabase.from('plans').delete().eq('coach_id', id)
    await supabase.from('blocks').delete().eq('coach_id', id)
    const { data, error } = await supabase.from('coaches').delete().eq('id', id).select('id')
    assertOk(error, 'delete coach')
    assertWrote(data, 'delete coach')
    return
  }
  await supabase.from('set_logs').update({ video_id: null }).eq('athlete_id', id)
  await supabase.from('videos').update({ log_id: null }).eq('athlete_id', id)
  const { data, error } = await supabase.from('athletes').delete().eq('id', id).select('id')
  assertOk(error, 'delete athlete')
  assertWrote(data, 'delete athlete')
}

export async function insertAthleteWithStructure(athlete) {
  await upsertAthleteProfile(athlete)
  if (athlete.coachId && (athlete.blocks || []).length) {
    await syncBlocks(athlete.id, athlete.blocks || [], athlete.coachId)
    for (const [blockKey, plan] of Object.entries(athlete.plans || {})) {
      if (plan) await upsertPlan(athlete.id, blockKey, { ...plan, coachId: athlete.coachId }, athlete.coachId)
    }
  }
}

export async function deleteVideo(athleteId, videoId) {
  const { error: logErr } = await supabase
    .from('set_logs')
    .update({ video_id: null })
    .eq('athlete_id', athleteId)
    .eq('video_id', videoId)
  assertOk(logErr, 'clear log video_id')
  const { error } = await supabase
    .from('videos')
    .delete()
    .eq('id', videoId)
    .eq('athlete_id', athleteId)
  assertOk(error, 'delete video')
}

export async function persistAthleteStructure(athlete, coachId) {
  await upsertAthleteProfile(athlete)
  const cid = coachId || athlete.coachId
  if (!cid) return
  const blocks = (athlete.blocks || []).map((b) => ({ ...b, coachId: b.coachId || cid }))
  await syncBlocks(athlete.id, blocks, cid)
  for (const [blockKey, plan] of Object.entries(athlete.plans || {})) {
    if (!plan) continue
    if (plan.coachId && plan.coachId !== cid) continue
    await upsertPlan(athlete.id, blockKey, { ...plan, coachId: cid }, cid)
  }
}

export async function persistPlan(athleteId, blockKey, plan, coachId) {
  await upsertPlan(athleteId, blockKey, plan, coachId || plan.coachId)
}

export async function endActiveStint(athleteId, { endTotalKg, endDots } = {}) {
  const { data: active, error: findErr } = await supabase
    .from('coaching_stints')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
    .maybeSingle()
  assertOk(findErr, 'find active stint')
  if (!active) return null
  const { data, error } = await supabase
    .from('coaching_stints')
    .update({
      status: 'ended',
      ended_at: new Date().toISOString(),
      end_total_kg: endTotalKg ?? null,
      end_dots: endDots ?? null,
    })
    .eq('id', active.id)
    .select('*')
    .single()
  assertOk(error, 'end coaching stint')
  await updateAthleteCoachId(athleteId, null)
  return mapStintRow(data)
}

export async function startCoachingStint({
  athleteId,
  coachId,
  transferHistory = false,
  startBodyweightKg,
  startTotalKg,
  startDots,
}) {
  const existing = await supabase
    .from('coaching_stints')
    .select('id')
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
    .maybeSingle()
  assertOk(existing.error, 'check active stint')
  if (existing.data) {
    throw new Error('Athlete already has an active coach. Disconnect first.')
  }

  const { data, error } = await supabase
    .from('coaching_stints')
    .insert({
      athlete_id: athleteId,
      coach_id: coachId,
      status: 'active',
      transfer_history: Boolean(transferHistory),
      start_bodyweight_kg: startBodyweightKg ?? null,
      start_total_kg: startTotalKg ?? null,
      start_dots: startDots ?? null,
    })
    .select('*')
  assertOk(error, 'start coaching stint')
  assertWrote(data, 'start coaching stint')
  await updateAthleteCoachId(athleteId, coachId)
  return mapStintRow(data[0])
}
