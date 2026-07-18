// Retention report — compares a club's membership across two terms (A → B) and
// classifies every person as New / Rejoined / Transferred / Remaining. Reads
// member_group_memberships scoped by each group's effective term. No new schema.

import type { GroupCode } from '~/composables/useGroupCodes'

export type RetentionStatus = 'new' | 'rejoined' | 'transferred' | 'remaining'

export interface RetentionPerson {
  id: string
  name: string
  email: string | null
  phone: string | null
  joinDate: string | null
  outstanding: number
  inA: boolean
  inB: boolean
  status: RetentionStatus
}

export interface RetentionData {
  terms: { id: string; name: string; start_date: string | null; end_date: string | null }[]
  codes: GroupCode[]
  // per person: term id -> set of code ids they were a (non-staff) member of that term
  memberTerms: Record<string, Record<string, Set<string>>>
  info: Record<string, { name: string; email: string | null; phone: string | null; joinDate: string | null }>
  outstanding: Record<string, number>
}

export const STATUS_META: Record<RetentionStatus, { label: string; color: string; tint: string; text: string; desc: string }> = {
  new: { label: 'New', color: '#059669', tint: 'bg-emerald-50', text: 'text-emerald-700', desc: 'First-ever enrolment this term' },
  rejoined: { label: 'Rejoined', color: '#2563EB', tint: 'bg-blue-50', text: 'text-blue-700', desc: 'Returned after a gap' },
  transferred: { label: 'Transferred', color: '#7C3AED', tint: 'bg-violet-50', text: 'text-violet-700', desc: 'Continued from the previous term' },
  remaining: { label: 'Remaining', color: '#D97706', tint: 'bg-amber-50', text: 'text-amber-700', desc: 'Was enrolled last term, not yet this term' },
}

export function useRetention() {
  // SEAM GAP (finances domain): the best-effort `registrations` outstanding-fees read
  // below has no groups-domain home — registrations belong to finances. Left on useDb
  // until useFinancesApi exposes outstanding-by-person. Everything else is on the seam.
  const db = useDb()
  const { orgId } = useOrg()
  const groupsApi = useGroupsApi()
  const gc = useGroupCodes()
  const tm = useTermsMemberships()
  const scoped = useScopedRoles()

  async function loadData(): Promise<RetentionData> {
    const empty: RetentionData = { terms: [], codes: [], memberTerms: {}, info: {}, outstanding: {} }
    if (!orgId.value) return empty
    await scoped.loadRoleDefs()
    const [terms, codes, groups] = await Promise.all([
      tm.loadTerms(),
      gc.loadCodes(),
      groupsApi.list(orgId.value),
    ])
    const codesById = Object.fromEntries((codes ?? []).map((c: any) => [c.id, c])) as Record<string, GroupCode>
    const groupIds = (groups ?? []).map((g) => g.id)
    if (!groupIds.length) return { ...empty, terms, codes }
    const groupTerm: Record<string, string | null> = {}
    const groupCode: Record<string, string> = {}
    // seam groups are camelCase; effectiveTermId reads code_id/term_id, so pass a
    // snake-compatible view.
    for (const g of groups) {
      const gv = { code_id: g.codeId, term_id: g.termId }
      groupTerm[g.id] = gc.effectiveTermId(gv, codesById)
      groupCode[g.id] = g.codeId ?? '__none'
    }

    const mems = await groupsApi.membershipsForRetention(groupIds)

    const memberTerms: RetentionData['memberTerms'] = {}
    const info: RetentionData['info'] = {}
    for (const m of mems) {
      const roleKeys = scoped.normalizeRoles('group', m.roles, m.role)
      if (scoped.isStaff('group', roleKeys)) continue // members only
      const term = groupTerm[m.groupId]
      if (!term) continue
      const pid = m.personId
      ;(memberTerms[pid] ??= {})[term] ??= new Set()
      memberTerms[pid][term].add(groupCode[m.groupId])
      const p = m.person
      const join = m.startDate || p?.createdAt?.slice(0, 10) || null
      if (!info[pid]) info[pid] = { name: `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || 'Unknown', email: p?.email ?? null, phone: p?.phone ?? null, joinDate: join }
      else if (join && (!info[pid].joinDate || join < info[pid].joinDate!)) info[pid].joinDate = join
    }

    // outstanding fees per person (best-effort — registrations may not exist for every club)
    const outstanding: Record<string, number> = {}
    const pids = Object.keys(memberTerms)
    if (pids.length) {
      try {
        // SEAM GAP (finances): registrations read — no groups-seam home.
        const { data: regs } = await (db.from as any)('registrations').select('person_id, total_amount, paid_amount').in('person_id', pids)
        for (const r of regs ?? []) {
          const owed = (Number(r.total_amount) || 0) - (Number(r.paid_amount) || 0)
          if (owed > 0) outstanding[r.person_id] = (outstanding[r.person_id] || 0) + owed
        }
      } catch { /* table/columns absent — leave outstanding empty */ }
    }

    return { terms, codes, memberTerms, info, outstanding }
  }

  // Pure comparison. filterA/filterB = code-id allow-lists (empty = all classes).
  function compute(data: RetentionData, termAId: string, termBId: string, filterA: string[] = [], filterB: string[] = []): { people: RetentionPerson[]; segments: Record<RetentionStatus, number>; countA: number; countB: number } {
    const termOrder = Object.fromEntries(data.terms.map((t, i) => [t.id, t.start_date || String(i).padStart(6, '0')]))
    const bStart = termOrder[termBId] ?? '~'
    const inSet = (codesForTerm: Set<string> | undefined, filter: string[]) => !!codesForTerm && (!filter.length || [...codesForTerm].some(c => filter.includes(c)))

    const people: RetentionPerson[] = []
    const segments: Record<RetentionStatus, number> = { new: 0, rejoined: 0, transferred: 0, remaining: 0 }
    for (const [pid, byTerm] of Object.entries(data.memberTerms)) {
      const inA = inSet(byTerm[termAId], filterA)
      const inB = inSet(byTerm[termBId], filterB)
      if (!inA && !inB) continue
      // any membership in a term that starts before term B (and isn't A/B)?
      let everBeforeB = false
      for (const [tid, codesForTerm] of Object.entries(byTerm)) {
        if (tid === termBId || tid === termAId) continue
        if ((termOrder[tid] ?? '~') < bStart && codesForTerm.size) { everBeforeB = true; break }
      }
      let status: RetentionStatus
      if (inA && inB) status = 'transferred'
      else if (inB && everBeforeB) status = 'rejoined'
      else if (inB) status = 'new'
      else status = 'remaining'
      segments[status]++
      const i = data.info[pid]
      people.push({ id: pid, name: i?.name ?? 'Unknown', email: i?.email ?? null, phone: i?.phone ?? null, joinDate: i?.joinDate ?? null, outstanding: data.outstanding[pid] || 0, inA, inB, status })
    }
    const order: RetentionStatus[] = ['transferred', 'rejoined', 'new', 'remaining']
    people.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.name.localeCompare(b.name))
    const countA = segments.transferred + segments.remaining
    const countB = segments.transferred + segments.rejoined + segments.new
    return { people, segments, countA, countB }
  }

  return { loadData, compute }
}
