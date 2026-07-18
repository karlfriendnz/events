// Term rollover — clone a term's groups into the next term.
//
// Model (clone-per-term): a member_groups row belongs to ONE term. Rolling over
// CLONES each source group into a new term — a fresh member_groups row per source
// (linked by lineage_id), carrying schedules / plans / a term-fee link, and
// staff + members per the user's per-group choice (rollover all / wipe / pick).
//
// Nested groups are cloned parent-before-child, remapping parent_id onto the new
// clones so the hierarchy is preserved. Idempotent per lineage+term.

import type { OrgTerm } from './useTermsMemberships'

export type CarryMode = 'rollover' | 'wipe' | 'pick'

// The dashboard's "time to roll over" nudge — see rolloverNudge() below.
export interface RolloverNudge {
  state: 'roll' | 'create-term'   // roll into the next term / no next term defined yet
  currentTerm: OrgTerm            // the ending (or just-ended) term that has groups
  nextTerm: OrgTerm | null        // null when state === 'create-term'
  daysLeft: number                // days until currentTerm ends; negative = ended N days ago
  total: number                   // groups in currentTerm
  remaining: number               // of those, not yet rolled into nextTerm
}

export interface RolloverPerson {
  id: string
  name: string
  roles: string[]
  role: string | null
  sub_group_id: string | null
}

export interface RolloverGroup {
  id: string
  name: string
  color: string | null
  parent_id: string | null
  sort_order: number | null
  lineage_id: string | null
  term_id: string | null
  code_id: string | null
  form_id: string | null
  image_url: string | null
  discontinued_at: string | null
  code: string | null
  age_range: string | null
  capacity: number | null
  term_fee: number | null
  gender_restriction: string | null
  sub_groups: any[]
  staff: RolloverPerson[]
  members: RolloverPerson[]
  depth: number
}

export interface RolloverPlan {
  source: RolloverGroup
  include: boolean
  name: string
  staffMode: CarryMode
  staffIds: string[]
  memberMode: CarryMode
  memberIds: string[]
}

export function useTermRollover() {
  // Fully on the /api/v1 seam. generateTrainingEvents() resolves each group's
  // staff-filtered member list client-side (role classification is a client concern)
  // and hands the whole series-materialisation + member-invite op to the events seam.
  const { orgId } = useOrg()
  const groupsApi = useGroupsApi()
  const eventsApi = useEventsApi()
  const tm = useTermsMemberships()
  const scoped = useScopedRoles()

  const nameOf = (first?: string | null, last?: string | null) => `${first ?? ''} ${last ?? ''}`.trim() || '—'

  // The most recent term (by start_date) that actually has groups — a sensible
  // default "source" for the rollover screen.
  async function mostRecentTermWithGroups(terms: OrgTerm[]): Promise<string | null> {
    if (!terms.length || !orgId.value) return null
    const groups = await groupsApi.list(orgId.value)
    const present = new Set(groups.map((g) => g.termId).filter(Boolean))
    const ordered = [...terms].sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))
    return ordered.find(t => present.has(t.id))?.id ?? null
  }

  // Load every group in a term, each with its memberships split into staff vs
  // members (same classification the group page uses) and depth for indenting.
  async function loadTermGroups(termId: string): Promise<RolloverGroup[]> {
    if (!termId || !orgId.value) return []
    await scoped.loadRoleDefs()
    // Groups in the term (seam list, camelCase → this composable's snake shape),
    // ordered by sort_order then name.
    const all = await groupsApi.list(orgId.value)
    const list = all
      .filter((g) => g.termId === termId)
      .map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color,
        parent_id: g.parentId,
        sort_order: g.sortOrder,
        lineage_id: g.lineageId,
        term_id: g.termId,
        code_id: g.codeId,
        form_id: g.formId,
        image_url: g.imageUrl,
        discontinued_at: g.discontinuedAt,
        code: g.code,
        age_range: g.ageRange,
        capacity: g.capacity,
        term_fee: g.termFee != null ? Number(g.termFee) : null,
        gender_restriction: g.genderRestriction,
        sub_groups: Array.isArray(g.subGroups) ? g.subGroups : [],
      }))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
    if (!list.length) return []

    const ids = list.map(g => g.id)
    const mems = await groupsApi.roster(ids)
    const byGroup: Record<string, typeof mems> = {}
    for (const m of mems) (byGroup[m.groupId] ??= []).push(m)

    // depth from parent_id within the loaded set
    const depthOf = (g: any): number => {
      let d = 1, cur = g, guard = 0
      while (cur?.parent_id && guard++ < 10) {
        const parent = list.find(x => x.id === cur.parent_id)
        if (!parent) break
        d++; cur = parent
      }
      return d
    }

    return list.map(g => {
      const staff: RolloverPerson[] = []
      const members: RolloverPerson[] = []
      for (const m of (byGroup[g.id] ?? [])) {
        const roles = scoped.normalizeRoles('group', m.roles, m.role)
        const person: RolloverPerson = {
          id: m.personId, name: nameOf(m.firstName, m.lastName), roles, role: m.role ?? roles[0] ?? null,
          sub_group_id: m.subGroupId ?? null,
        }
        if (scoped.isStaff('group', roles)) staff.push(person)
        else members.push(person)
      }
      staff.sort((a, b) => a.name.localeCompare(b.name))
      members.sort((a, b) => a.name.localeCompare(b.name))
      return { ...g, staff, members, depth: depthOf(g) }
    })
  }

  // Which lineages already have a clone in the target term (to flag/skip).
  async function lineagesInTerm(termId: string): Promise<Set<string>> {
    if (!orgId.value) return new Set()
    const all = await groupsApi.list(orgId.value)
    return new Set(all.filter((g) => g.termId === termId).map((g) => g.lineageId).filter(Boolean) as string[])
  }

  function pickPeople(list: RolloverPerson[], mode: CarryMode, ids: string[]): RolloverPerson[] {
    if (mode === 'wipe') return []
    if (mode === 'pick') return list.filter(p => ids.includes(p.id))
    return list
  }

  // Clone the selected source groups into targetTerm (schedules / plans / term-fee /
  // fee options / the chosen people + waitlists) — the whole clone runs server-side in
  // one seam call. The client resolves each plan's people (wipe/pick/rollover) and the
  // per-group source metadata; the repo re-reads schedules/fees/plans/waitlists.
  async function rollOverGroups(targetTerm: OrgTerm, plans: RolloverPlan[]): Promise<{ created: number }> {
    const chosen = plans.filter(p => p.include)
    if (!chosen.length) return { created: 0 }
    const payload = chosen.map((p) => {
      const src = p.source
      const people = [
        ...pickPeople(src.staff, p.staffMode, p.staffIds),
        ...pickPeople(src.members, p.memberMode, p.memberIds),
      ].map((person) => ({
        personId: person.id,
        roles: person.roles ?? (person.role ? [person.role] : []),
        role: person.role ?? person.roles?.[0] ?? null,
        subGroupId: person.sub_group_id ?? null,
      }))
      return {
        sourceId: src.id,
        parentSourceId: src.parent_id ?? null,
        name: p.name?.trim() || src.name,
        color: src.color ?? null,
        sortOrder: src.sort_order ?? null,
        codeId: src.code_id ?? null,
        formId: src.form_id ?? null,
        imageUrl: src.image_url ?? null,
        code: src.code ?? null,
        ageRange: src.age_range ?? null,
        capacity: src.capacity ?? null,
        termFee: src.term_fee ?? null,
        genderRestriction: src.gender_restriction ?? null,
        subGroups: src.sub_groups ?? [],
        lineageId: src.lineage_id ?? null,
        people,
      }
    })
    return await groupsApi.rollover({
      orgId: orgId.value,
      targetTerm: {
        id: targetTerm.id,
        name: targetTerm.name ?? null,
        startDate: targetTerm.start_date ?? null,
        endDate: targetTerm.end_date ?? null,
      },
      plans: payload,
    })
  }

  // Generate the term's weekly training events for a set of groups — the same
  // master + weekly-children pattern as the group page's "Create training
  // events" button, but scoped to the TERM's date window. Idempotent: schedule
  // rows that already have a linked master event are skipped. Members (not
  // staff) are invited to every occurrence so attendance opens pre-rostered.
  async function generateTrainingEvents(term: OrgTerm, groupIds: string[]): Promise<{ events: number; classes: number }> {
    if (!groupIds.length || !term.start_date || !term.end_date || !orgId.value) return { events: 0, classes: 0 }
    await scoped.loadRoleDefs()
    // Resolve each group's staff-filtered members (the invitees the server will roster)
    // — role classification is a client concern; the seam takes the resolved lists.
    const mems = await groupsApi.roster(groupIds)
    const membersByGroup: Record<string, string[]> = {}
    for (const m of mems) {
      const roles = scoped.normalizeRoles('group', m.roles, m.role)
      if (!scoped.isStaff('group', roles)) (membersByGroup[m.groupId] ??= []).push(m.personId)
    }
    // The series materialisation + member-invite runs server-side in one seam call
    // (idempotent — schedules with an existing master event are skipped).
    return await eventsApi.generateTrainingEvents({
      orgId: orgId.value,
      groupIds,
      window: { start: term.start_date, end: term.end_date },
      membersByGroup,
    })
  }

  // Should the club be nudged to roll over? True when a term that HAS groups is
  // ending within `leadDays` (or ended up to `graceDays` ago) and some of its
  // groups have no clone in the next term yet. Two cheap queries; returns null
  // when there's nothing to nudge about (no terms, all rolled, too early).
  async function rolloverNudge(leadDays = 21, graceDays = 45): Promise<RolloverNudge | null> {
    if (!orgId.value) return null
    const [terms, allGroups] = await Promise.all([
      tm.loadTerms(),
      groupsApi.list(orgId.value),
    ])
    const termList = (terms ?? []) as OrgTerm[]
    // Only groups actually attached to a term matter for the nudge.
    const groups = allGroups.filter((g) => g.termId)
    if (!termList.length || !groups.length) return null

    const byTerm: Record<string, { lineages: Set<string>; rolledFrom: Set<string>; count: number }> = {}
    for (const g of groups) {
      const b = (byTerm[g.termId!] ??= { lineages: new Set(), rolledFrom: new Set(), count: 0 })
      if (!g.discontinuedAt) b.count++   // discontinued classes don't count as roll-over work
      if (g.lineageId) b.lineages.add(g.lineageId)
      if (g.rolledFromGroupId) b.rolledFrom.add(g.rolledFromGroupId)
    }

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const daysUntil = (iso: string | null) =>
      iso == null ? null : Math.round((new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86400000)

    // Candidate "current" terms: have groups, and end inside the nudge window.
    // Latest end_date first, so the term actually running wins over older ones.
    const candidates = termList
      .filter(t => byTerm[t.id]?.count && t.end_date)
      .map(t => ({ t, left: daysUntil(t.end_date)! }))
      .filter(x => x.left <= leadDays && x.left >= -graceDays)
      .sort((a, b) => b.left - a.left)

    for (const { t, left } of candidates) {
      // "The next term" only exists within the same TERM SET (migration 232) —
      // the Seniors' second half is never the juniors' Term 4.
      const next = termList.find(n =>
        n.id !== t.id
        && ((n as any).set_id ?? null) === ((t as any).set_id ?? null)
        && (n.start_date ?? '') > (t.start_date ?? '')) ?? null
      const total = byTerm[t.id].count
      if (!next) return { state: 'create-term', currentTerm: t, nextTerm: null, daysLeft: left, total, remaining: total }
      const nextInfo = byTerm[next.id] ?? { lineages: new Set(), rolledFrom: new Set() }
      const remaining = groups.filter((g) =>
        g.termId === t.id
        && !g.discontinuedAt
        && (!g.lineageId || !nextInfo.lineages.has(g.lineageId))
        && !nextInfo.rolledFrom.has(g.id)).length
      if (remaining > 0) return { state: 'roll', currentTerm: t, nextTerm: next, daysLeft: left, total, remaining }
    }
    return null
  }

  return { mostRecentTermWithGroups, loadTermGroups, lineagesInTerm, rollOverGroups, rolloverNudge, generateTrainingEvents }
}
