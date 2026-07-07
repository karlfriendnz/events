// Class Finder — a reusable "find an appropriate class for someone" tool.
// Parameter-only search over the club's classes (reuses useClassTimetable's loader),
// results ranked by fit, with a shortlist to compare. Shared open-state + shortlist
// live in useState so ANY screen can drop in a trigger button and the drawer (mounted
// once in the layout) responds. No new schema — reads existing group/schedule data.

import { minLabel, type TimetableSession } from '~/composables/useClassTimetable'

export type TimeBand = 'any' | 'morning' | 'afternoon' | 'evening'

export interface FinderParams {
  age: number | null
  days: number[]           // 0=Sun..6=Sat; empty = any day
  timeBand: TimeBand
  codeIds: string[]        // empty = any programme
  disciplineIds: string[]  // empty = any discipline
  gender: string | null    // MALE | FEMALE | NON_BINARY | null(any)
  venue: string | null     // LOCATION id (the club's sites, mig 237) | null(any)
  termId: string | null    // effective term | null(any)
  onlyWithSpace: boolean
}

export interface FinderSession { day: number; startMin: number; endMin: number; label: string }
export interface FinderClass {
  groupId: string
  locationId?: string | null
  name: string
  codeId: string | null
  codeName: string | null
  color: string
  venues: string[]
  coach: string | null
  count: number
  capacity: number | null
  spaces: number | null        // capacity - count (null = uncapped)
  gender: string | null        // gender_restriction
  ageMin: number | null
  ageMax: number | null
  ageRange: string | null
  termId: string | null
  disciplineIds: string[]
  disciplines: { id: string; name: string }[]
  sessions: FinderSession[]
  score: number
}

const BANDS: Record<Exclude<TimeBand, 'any'>, [number, number]> = {
  morning: [0, 12 * 60],
  afternoon: [12 * 60, 17 * 60],
  evening: [17 * 60, 24 * 60],
}

export const GENDER_OPTIONS = [
  { label: 'Any', value: null },
  { label: 'Male', value: 'MALE' },
  { label: 'Female', value: 'FEMALE' },
  { label: 'Non-binary', value: 'NON_BINARY' },
]
export const TIME_BANDS = [
  { label: 'Any time', value: 'any' },
  { label: 'Morning', value: 'morning' },
  { label: 'Afternoon', value: 'afternoon' },
  { label: 'Evening', value: 'evening' },
]
export const WEEKDAYS = [
  { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 }, { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 }, { label: 'Sun', value: 0 },
]

export function defaultFinderParams(): FinderParams {
  return { age: null, days: [], timeBand: 'any', codeIds: [], disciplineIds: [], gender: null, venue: null, termId: null, onlyWithSpace: true }
}

// Best-effort parse of a free-text age_range ("5-8", "Under 12", "10+", "6").
export function parseAgeRange(s: string | null): { min: number | null; max: number | null } {
  if (!s) return { min: null, max: null }
  const nums = (s.match(/\d+/g) ?? []).map(Number)
  const low = s.toLowerCase()
  if (/under|below|<|up to/.test(low) && nums.length) return { min: null, max: nums[0] }
  if (/(\+|over|above|and up|plus|\bup\b)/.test(low) && nums.length) return { min: nums[0], max: null }
  if (nums.length >= 2) return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) }
  if (nums.length === 1) return { min: nums[0], max: nums[0] }
  return { min: null, max: null }
}

export function useClassFinder() {
  const ct = useClassTimetable()
  const db = useDb()

  // Shared state (persists across route changes; the drawer is mounted once in the layout).
  const open = useState<boolean>('classFinder.open', () => false)
  const params = useState<FinderParams>('classFinder.params', () => defaultFinderParams())
  const context = useState<{ label?: string } | null>('classFinder.context', () => null)

  function openFinder(prefill?: Partial<FinderParams>, ctx?: { label?: string }) {
    if (prefill) params.value = { ...params.value, ...prefill }
    context.value = ctx ?? null
    open.value = true
  }
  function close() { open.value = false }
  function resetParams() { params.value = defaultFinderParams() }

  // Aggregate the timetable's per-schedule sessions into one row per class (group).
  async function loadClasses(): Promise<{ classes: FinderClass[]; codes: any[]; disciplines: { id: string; name: string; sport: string | null }[] }> {
    const { sessions: allSessions2, codes } = await ct.loadSessions()
    // Location lens: classes outside the active location never surface in the finder.
    const { inActiveLocation } = useActiveLocation()
    const sessions = allSessions2.filter(s => inActiveLocation(s.locationId))
    const byGroup = new Map<string, FinderClass>()
    for (const s of sessions as TimetableSession[]) {
      let g = byGroup.get(s.groupId)
      if (!g) {
        const { min, max } = parseAgeRange(s.ageRange)
        g = {
          groupId: s.groupId, name: s.groupName, codeId: s.codeId, codeName: s.codeName, color: s.color,
          venues: [], locationId: s.locationId ?? null, coach: s.coach, count: s.count, capacity: s.capacity,
          spaces: s.capacity == null ? null : Math.max(s.capacity - s.count, 0),
          gender: s.genderRestriction, ageMin: min, ageMax: max, ageRange: s.ageRange, termId: s.termId,
          disciplineIds: [], disciplines: [], sessions: [], score: 0,
        }
        byGroup.set(s.groupId, g)
      }
      g.sessions.push({ day: s.day, startMin: s.startMin, endMin: s.endMin, label: `${dayShort(s.day)} ${minLabel(s.startMin)}–${minLabel(s.endMin)}` })
      if (s.venue && !g.venues.includes(s.venue)) g.venues.push(s.venue)
    }

    // Disciplines each class is mapped to (member_group_disciplines → disciplines).
    // Only disciplines actually in use become chooser options.
    const groupIds = [...byGroup.keys()]
    const discOptions = new Map<string, { id: string; name: string; sport: string | null }>()
    if (groupIds.length) {
      const { data: links } = await (db.from as any)('member_group_disciplines')
        .select('group_id, discipline_id, discipline:disciplines(id, name, sport)').in('group_id', groupIds)
      for (const l of links ?? []) {
        const g = byGroup.get(l.group_id); const d = l.discipline
        if (!g || !d) continue
        if (!g.disciplineIds.includes(d.id)) { g.disciplineIds.push(d.id); g.disciplines.push({ id: d.id, name: d.name }) }
        if (!discOptions.has(d.id)) discOptions.set(d.id, { id: d.id, name: d.name, sport: d.sport ?? null })
      }
    }
    const disciplines = [...discOptions.values()].sort((a, b) => a.name.localeCompare(b.name))
    return { classes: [...byGroup.values()], codes, disciplines }
  }

  // Pure filter + rank. Hard filters exclude; soft matches boost the score.
  function match(classes: FinderClass[], p: FinderParams): FinderClass[] {
    const out: FinderClass[] = []
    for (const c of classes) {
      let score = 0
      // term (hard)
      if (p.termId && c.termId !== p.termId) continue
      // programme/code (hard)
      if (p.codeIds.length && !(c.codeId && p.codeIds.includes(c.codeId))) continue
      // discipline (hard)
      if (p.disciplineIds.length && !c.disciplineIds.some(id => p.disciplineIds.includes(id))) continue
      // location (hard) — p.venue holds a location id
      if (p.venue && c.locationId !== p.venue) continue
      // gender (hard) — a restricted class must not conflict with the requested gender
      if (p.gender && c.gender && c.gender !== p.gender) continue
      if (p.gender && c.gender === p.gender) score += 1
      // space (hard when requested)
      const hasSpace = c.spaces == null || c.spaces > 0
      if (p.onlyWithSpace && !hasSpace) continue
      if (hasSpace && c.spaces != null) score += 1
      // age — hard exclude when clearly out of a KNOWN range; boost when in range
      if (p.age != null && (c.ageMin != null || c.ageMax != null)) {
        if (c.ageMin != null && p.age < c.ageMin) continue
        if (c.ageMax != null && p.age > c.ageMax) continue
        score += 2
      }
      // days — require a session on one of the chosen days
      if (p.days.length) {
        if (!c.sessions.some(s => p.days.includes(s.day))) continue
        score += 1
      }
      // time band — require a session in the band
      if (p.timeBand !== 'any') {
        const [lo, hi] = BANDS[p.timeBand]
        if (!c.sessions.some(s => s.startMin >= lo && s.startMin < hi)) continue
        score += 1
      }
      out.push({ ...c, score })
    }
    // best fit first, then most availability, then name
    return out.sort((a, b) =>
      b.score - a.score ||
      (b.spaces ?? 999) - (a.spaces ?? 999) ||
      a.name.localeCompare(b.name))
  }

  return { open, params, context, openFinder, close, resetParams, loadClasses, match }
}

function dayShort(d: number) { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d] ?? '' }
