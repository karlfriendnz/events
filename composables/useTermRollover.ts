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
  // SEAM GAP (events domain): generateTrainingEvents() below writes `events` + `invitees`
  // (events-domain tables) alongside reading schedules/memberships — it stays on useDb
  // until useEventsApi exposes a "generate training series + invite members" op. Every
  // other function here is on the /api/v1 seam.
  const db = useDb()
  const { orgId } = useOrg()
  const groupsApi = useGroupsApi()
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
    const { expandRrule, dateKey } = await import('~/composables/useRecurrence')
    await scoped.loadRoleDefs()
    const [{ data: scheds }, { data: linked }, { data: mems }, { data: groups }] = await Promise.all([
      (db.from as any)('member_group_schedules').select('*').in('group_id', groupIds).order('sort_order'),
      (db.from as any)('events').select('member_group_schedule_id').in('member_group_id', groupIds).not('member_group_schedule_id', 'is', null),
      (db.from as any)('member_group_memberships').select('group_id, person_id, roles, role').in('group_id', groupIds),
      (db.from as any)('member_groups').select('id, name').in('id', groupIds),
    ])
    const nameById: Record<string, string> = Object.fromEntries((groups ?? []).map((g: any) => [g.id, g.name]))
    const membersByGroup: Record<string, string[]> = {}
    for (const m of (mems ?? [])) {
      const roles = scoped.normalizeRoles('group', m.roles, m.role)
      if (!scoped.isStaff('group', roles)) (membersByGroup[m.group_id] ??= []).push(m.person_id)
    }
    const alreadyLinked = new Set((linked ?? []).map((r: any) => r.member_group_schedule_id))

    const untilStr = `${term.end_date.replace(/-/g, '')}T235959Z`
    const [ey, em, ed] = term.end_date.split('-').map(Number)
    const termEndDate = new Date(ey, (em ?? 1) - 1, ed ?? 1, 23, 59, 59)
    const [ty, tm2, td] = term.start_date.split('-').map(Number)
    const byDayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    let events = 0
    const touched = new Set<string>()
    for (const sched of (scheds ?? [])) {
      if (alreadyLinked.has(sched.id)) continue
      const first = new Date(ty, (tm2 ?? 1) - 1, td ?? 1)
      while (first.getDay() !== sched.day_of_week) first.setDate(first.getDate() + 1)
      if (first > termEndDate) continue

      const loc = sched.location || {}
      const [sh, smin] = String(sched.start_time || '0:0').split(':').map(Number)
      const [eh, emin] = String(sched.end_time || '0:0').split(':').map(Number)
      const masterStart = new Date(first.getFullYear(), first.getMonth(), first.getDate(), sh ?? 0, smin ?? 0)
      const masterEnd = new Date(first.getFullYear(), first.getMonth(), first.getDate(), eh ?? 0, emin ?? 0)
      const duration = masterEnd.getTime() - masterStart.getTime()
      const rrule = `FREQ=WEEKLY;BYDAY=${byDayCodes[sched.day_of_week]};UNTIL=${untilStr}`
      const groupName = nameById[sched.group_id] ?? 'Class'

      const sharedFields = {
        org_id: orgId.value,
        title: sched.name?.trim() ? `${groupName} — ${sched.name.trim()}` : `${groupName} — ${dayNames[sched.day_of_week]} Training`,
        style: 'BASIC',
        member_group_id: sched.group_id,
        member_group_schedule_id: sched.id,
        location_type: loc.type ?? null,
        bookable_id: loc.type === 'BOOKABLE' ? (loc.bookable_ids?.[0] ?? null) : null,
        address: loc.type === 'ADDRESS' ? ([loc.venue_name, loc.address].filter(Boolean).join(', ') || null) : null,
        meeting_link: loc.type === 'ONLINE' ? (loc.meeting_link || null) : null,
        status: 'DRAFT',
      }
      const { data: master } = await (db.from as any)('events').insert({
        ...sharedFields,
        start_at: masterStart.toISOString(),
        end_at: masterEnd.toISOString(),
        recurrence_rule: rrule,
      }).select('id').single()
      if (!master) continue

      const occurrences = expandRrule(rrule, masterStart, termEndDate, 200)
      const masterKey = dateKey(masterStart)
      const { member_group_schedule_id: _omit, ...childShared } = sharedFields
      const childRows = occurrences
        .filter((d: Date) => dateKey(d) !== masterKey)
        .map((d: Date) => {
          const childStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh ?? 0, smin ?? 0)
          return {
            ...childShared,
            recurrence_parent_id: master.id,
            recurrence_rule: null,
            start_at: childStart.toISOString(),
            end_at: new Date(childStart.getTime() + duration).toISOString(),
          }
        })
      const eventIds: string[] = [master.id]
      if (childRows.length) {
        const { data: kids } = await (db.from as any)('events').insert(childRows).select('id')
        for (const c of (kids ?? [])) eventIds.push(c.id)
      }
      const people = membersByGroup[sched.group_id] ?? []
      if (people.length) {
        const inviteeRows: any[] = []
        for (const eid of eventIds) for (const pid of people) inviteeRows.push({ event_id: eid, person_id: pid, status: 'INVITED' })
        await (db.from as any)('invitees').insert(inviteeRows)
      }
      events += eventIds.length
      touched.add(sched.group_id)
    }
    return { events, classes: touched.size }
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
