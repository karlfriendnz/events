// Class timetable data (Week View). Loads the org's recurring class times
// (member_group_schedules) joined to their group + code/programme + head coach +
// member count, and lays out overlapping sessions into side-by-side lanes so a
// time-grid can position each block. No new schema — reads existing data.

import type { GroupCode } from '~/composables/useGroupCodes'
import { locationSummary, type LocationEntry } from '~/composables/useLocation'

export interface TimetableSession {
  id: string
  groupId: string
  groupName: string
  codeId: string | null
  codeName: string | null
  color: string
  day: number          // 0=Sun .. 6=Sat
  startMin: number     // minutes from midnight
  endMin: number
  startLabel: string
  endLabel: string
  coach: string | null
  count: number
  capacity: number | null
  venue: string
  sport: string | null
  termId: string | null
  genderRestriction: string | null
  ageRange: string | null
  imageUrl: string | null
  locationId: string | null
  // layout (filled per day by layoutDay)
  lane?: number
  cols?: number
}

const PALETTE = ['#1E2157', '#2563EB', '#0f766e', '#059669', '#9333ea', '#EC4899', '#c2410c', '#be123c', '#8B5CF6', '#0369a1', '#15803d', '#b45309']
function colorFor(id: string) { let h = 0; for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return PALETTE[h % PALETTE.length] }

function toMin(t: string | null): number {
  if (!t) return 0
  const [h, m] = t.split(':')
  return (parseInt(h, 10) || 0) * 60 + (parseInt(m || '0', 10) || 0)
}
export function minLabel(mins: number): string {
  let h = Math.floor(mins / 60), m = mins % 60
  const ap = h >= 12 ? 'pm' : 'am'
  const h12 = ((h + 11) % 12) + 1
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, '0')}${ap}`
}

// Maximal-overlap-cluster lane assignment (google-calendar style): each cluster of
// transitively-overlapping sessions is split into N equal columns.
export function layoutDay<T extends { startMin: number; endMin: number }>(items: T[]): (T & { lane: number; cols: number })[] {
  const evs = items.map(e => ({ ...e, lane: 0, cols: 1 })).sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const out: (T & { lane: number; cols: number })[] = []
  let cluster: (T & { lane: number; cols: number })[] = []
  let clusterEnd = -1
  const flush = () => {
    if (!cluster.length) return
    const laneEnds: number[] = []
    for (const e of cluster) {
      let i = 0
      for (; i < laneEnds.length; i++) if (laneEnds[i] <= e.startMin) break
      e.lane = i; laneEnds[i] = e.endMin
    }
    const cols = laneEnds.length
    for (const e of cluster) e.cols = cols
    out.push(...cluster); cluster = []
  }
  for (const e of evs) {
    if (cluster.length && e.startMin >= clusterEnd) { flush(); clusterEnd = -1 }
    cluster.push(e); clusterEnd = Math.max(clusterEnd, e.endMin)
  }
  flush()
  return out
}

export function useClassTimetable() {
  const { orgId } = useOrg()
  const groupsApi = useGroupsApi()
  const gc = useGroupCodes()
  const scoped = useScopedRoles()

  // Returns every scheduled class session for the org (unfiltered).
  async function loadSessions(): Promise<{ sessions: TimetableSession[]; codes: GroupCode[] }> {
    if (!orgId.value) return { sessions: [], codes: [] }
    await scoped.loadRoleDefs()
    const [codes, groups] = await Promise.all([
      gc.loadCodes(),
      groupsApi.list(orgId.value),
    ])
    const codesById = Object.fromEntries((codes ?? []).map((c: any) => [c.id, c])) as Record<string, GroupCode>
    const groupIds = (groups ?? []).map((g) => g.id)
    if (!groupIds.length) return { sessions: [], codes: codes ?? [] }

    const [scheds, mems] = await Promise.all([
      groupsApi.schedulesForGroups(groupIds),
      groupsApi.membershipsWithPersonForGroups(groupIds),
    ])

    // head coach + non-staff member count per group
    const headByGroup: Record<string, string> = {}
    const countByGroup: Record<string, number> = {}
    for (const m of mems) {
      const roleKeys = scoped.normalizeRoles('group', m.roles, m.role)
      if (scoped.isStaff('group', roleKeys)) {
        if (!headByGroup[m.groupId]) headByGroup[m.groupId] = `${m.person?.firstName ?? ''} ${m.person?.lastName ?? ''}`.trim()
      } else countByGroup[m.groupId] = (countByGroup[m.groupId] || 0) + 1
    }
    const groupById = Object.fromEntries((groups ?? []).map((g) => [g.id, g]))

    const sessions: TimetableSession[] = []
    for (const s of scheds) {
      const g: any = groupById[s.groupId]
      if (!g) continue
      const code = g.codeId ? codesById[g.codeId] : null
      const startMin = toMin(s.startTime), endMin = Math.max(toMin(s.endTime), toMin(s.startTime) + 15)
      const loc = s.location ? locationSummary([s.location as LocationEntry]) : ''
      // effectiveTermId reads code_id/term_id (snake) — pass a compatible view.
      const gv = { code_id: g.codeId, term_id: g.termId }
      sessions.push({
        id: s.id, groupId: g.id, groupName: g.name,
        codeId: g.codeId ?? null, codeName: code?.name ?? null,
        color: code?.color || g.color || colorFor(g.codeId || g.id),
        day: s.dayOfWeek ?? 0, startMin, endMin,
        startLabel: minLabel(startMin), endLabel: minLabel(endMin),
        coach: headByGroup[g.id] || null,
        count: countByGroup[g.id] || 0,
        capacity: g.capacity ?? null,
        venue: loc && loc !== '—' ? loc : '',
        sport: null,
        termId: gc.effectiveTermId(gv, codesById),
        genderRestriction: g.genderRestriction ?? null,
        ageRange: g.ageRange ?? null,
        imageUrl: g.imageUrl ?? null,
        locationId: g.locationId ?? null,
      })
    }
    return { sessions, codes: codes ?? [] }
  }

  return { loadSessions, layoutDay, minLabel }
}
