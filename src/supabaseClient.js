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

export function mapCoachRow(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    code: row.code,
  }
}

/** Map an athletes table row into the app's athlete profile shape (no logs/plans). */
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

/**
 * Overlay Supabase profile fields onto an existing athlete object,
 * keeping mock blocks / plans / logs / videos until those are wired.
 */
export function mergeAthleteProfile(profile, mock = {}) {
  return {
    ...mock,
    ...profile,
    blocks: mock.blocks || [],
    plans: mock.plans || {},
    logs: mock.logs || [],
    videos: mock.videos || [],
    e1rmSeries: mock.e1rmSeries || [],
    scheduleOverrides: mock.scheduleOverrides || [],
  }
}

export async function fetchCoaches() {
  const { data, error } = await supabase
    .from('coaches')
    .select('id, name, code')
    .order('name')
  if (error) throw error
  return (data || []).map(mapCoachRow)
}

export async function fetchAthletes() {
  const { data, error } = await supabase
    .from('athletes')
    .select('id, name, code, coach_id, event, meet_date, planning_mode, block_weeks, start_date, pbs, e1rm, accessory_library, lift_library')
    .order('name')
  if (error) throw error
  return (data || []).map(mapAthleteProfile)
}

export async function updateAthleteCoachId(athleteId, coachId) {
  const { data, error } = await supabase
    .from('athletes')
    .update({ coach_id: coachId, updated_at: new Date().toISOString() })
    .eq('id', athleteId)
    .select('id, coach_id')
    .single()
  if (error) throw error
  return data
}
