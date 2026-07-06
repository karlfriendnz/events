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
  const db = useDb()
  const { orgId } = useOrg()
  const scoped = useScopedRoles()

  const nameOf = (p: any) => `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || '—'

  // The most recent term (by start_date) that actually has groups — a sensible
  // default "source" for the rollover screen.
  async function mostRecentTermWithGroups(terms: OrgTerm[]): Promise<string | null> {
    if (!terms.length) return null
    const { data } = await (db.from as any)('member_groups')
      .select('term_id')
      .eq('org_id', orgId.value)
      .not('term_id', 'is', null)
    const present = new Set((data ?? []).map((r: any) => r.term_id))
    const ordered = [...terms].sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))
    return ordered.find(t => present.has(t.id))?.id ?? null
  }

  // Load every group in a term, each with its memberships split into staff vs
  // members (same classification the group page uses) and depth for indenting.
  async function loadTermGroups(termId: string): Promise<RolloverGroup[]> {
    if (!termId || !orgId.value) return []
    await scoped.loadRoleDefs()
    const { data: groups } = await (db.from as any)('member_groups')
      .select('id, name, color, parent_id, sort_order, lineage_id, term_id, code_id, form_id, image_url, discontinued_at, code, age_range, capacity, term_fee, gender_restriction, sub_groups')
      .eq('org_id', orgId.value)
      .eq('term_id', termId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name')
    const list = (groups ?? []) as any[]
    if (!list.length) return []

    const ids = list.map(g => g.id)
    const { data: mems } = await (db.from as any)('member_group_memberships')
      .select('group_id, person_id, roles, role, sub_group_id, person:persons!inner(id, first_name, last_name)')
      .in('group_id', ids)
    const byGroup: Record<string, any[]> = {}
    for (const m of (mems ?? [])) (byGroup[m.group_id] ??= []).push(m)

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
        if (!m.person) continue
        const roles = scoped.normalizeRoles('group', m.roles, m.role)
        const person: RolloverPerson = {
          id: m.person_id, name: nameOf(m.person), roles, role: m.role ?? roles[0] ?? null,
          sub_group_id: m.sub_group_id ?? null,
        }
        if (scoped.isStaff('group', roles)) staff.push(person)
        else members.push(person)
      }
      staff.sort((a, b) => a.name.localeCompare(b.name))
      members.sort((a, b) => a.name.localeCompare(b.name))
      return { ...g, sub_groups: Array.isArray(g.sub_groups) ? g.sub_groups : [], staff, members, depth: depthOf(g) }
    })
  }

  // Which lineages already have a clone in the target term (to flag/skip).
  async function lineagesInTerm(termId: string): Promise<Set<string>> {
    const { data } = await (db.from as any)('member_groups')
      .select('lineage_id')
      .eq('org_id', orgId.value)
      .eq('term_id', termId)
    return new Set((data ?? []).map((r: any) => r.lineage_id).filter(Boolean))
  }

  function pickPeople(list: RolloverPerson[], mode: CarryMode, ids: string[]): RolloverPerson[] {
    if (mode === 'wipe') return []
    if (mode === 'pick') return list.filter(p => ids.includes(p.id))
    return list
  }

  // Clone the selected source groups into targetTerm. Returns how many were made.
  async function rollOverGroups(targetTerm: OrgTerm, plans: RolloverPlan[]): Promise<{ created: number }> {
    const chosen = plans.filter(p => p.include)
    if (!chosen.length) return { created: 0 }
    const includedIds = new Set(chosen.map(p => p.source.id))

    // Bulk-fetch schedules + plan links for the included source groups.
    const srcIds = [...includedIds]
    const [{ data: scheds }, { data: planLinks }, { data: feeOpts }] = await Promise.all([
      (db.from as any)('member_group_schedules')
        .select('group_id, day_of_week, start_time, end_time, location, sort_order').in('group_id', srcIds),
      (db.from as any)('member_group_plans').select('group_id, plan_id').in('group_id', srcIds),
      (db.from as any)('group_fee_options').select('*').in('group_id', srcIds),
    ])
    const schedsBy: Record<string, any[]> = {}
    for (const s of (scheds ?? [])) (schedsBy[s.group_id] ??= []).push(s)
    const plansBy: Record<string, any[]> = {}
    for (const l of (planLinks ?? [])) (plansBy[l.group_id] ??= []).push(l)
    // Fee options (+ their line items) to clone into the new groups.
    const feeOptsBy: Record<string, any[]> = {}
    for (const f of (feeOpts ?? [])) (feeOptsBy[f.group_id] ??= []).push(f)
    const feeItemsBy: Record<string, any[]> = {}
    if ((feeOpts ?? []).length) {
      const { data: feeItems } = await (db.from as any)('group_fee_option_items')
        .select('*').in('option_id', (feeOpts ?? []).map((f: any) => f.id))
      for (const it of (feeItems ?? [])) (feeItemsBy[it.option_id] ??= []).push(it)
    }

    // Process parents before children so parent_id can be remapped to the clone.
    const idToNew = new Map<string, string>()
    const pending = [...chosen]
    let created = 0
    let guard = 0
    while (pending.length && guard++ < pending.length + chosen.length + 5) {
      const p = pending.shift()!
      const srcParent = p.source.parent_id
      const parentIncluded = srcParent && includedIds.has(srcParent)
      // Wait until an included parent has been cloned.
      if (parentIncluded && !idToNew.has(srcParent!)) { pending.push(p); continue }
      const newParentId = parentIncluded ? idToNew.get(srcParent!)! : null
      const newId = await cloneOne(p, targetTerm, newParentId, schedsBy, plansBy, feeOptsBy, feeItemsBy)
      idToNew.set(p.source.id, newId)
      created++
    }
    await rollOverWaitlists(targetTerm, idToNew)
    return { created }
  }

  // Roll the source groups' waitlists into the target term: for each waitlist
  // connected to any rolled group, clone it into the target term under the same
  // lineage (idempotent), reconnect the NEW groups, and carry the people waiting.
  async function rollOverWaitlists(targetTerm: OrgTerm, idToNew: Map<string, string>) {
    const srcGroupIds = [...idToNew.keys()]
    if (!srcGroupIds.length) return
    const { data: linked } = await (db.from as any)('member_groups')
      .select('id, waitlist_id').in('id', srcGroupIds).not('waitlist_id', 'is', null)
    if (!linked?.length) return
    // source waitlist id → the NEW (cloned) group ids that should connect to it
    const newGroupsByWl: Record<string, string[]> = {}
    for (const g of linked) (newGroupsByWl[g.waitlist_id] ??= []).push(idToNew.get(g.id)!)

    const srcWlIds = Object.keys(newGroupsByWl)
    const [{ data: srcWls }, { data: existing }] = await Promise.all([
      (db.from as any)('waitlists').select('*').in('id', srcWlIds),
      (db.from as any)('waitlists').select('id, lineage_id').eq('org_id', orgId.value).eq('term_id', targetTerm.id),
    ])
    const existingByLineage: Record<string, string> = {}
    for (const w of (existing ?? [])) if (w.lineage_id) existingByLineage[w.lineage_id] = w.id

    for (const src of (srcWls ?? [])) {
      const lineage = src.lineage_id || src.id
      let targetId = existingByLineage[lineage]
      if (!targetId) {
        const { data: created } = await (db.from as any)('waitlists').insert({
          org_id: orgId.value, name: src.name, order_mode: src.order_mode ?? 'custom',
          term_id: targetTerm.id, lineage_id: lineage, rolled_from_id: src.id,
        }).select('id').single()
        targetId = created?.id
        if (!targetId) continue
      }
      // connect the new groups to the target waitlist
      await (db.from as any)('member_groups').update({ waitlist_id: targetId }).in('id', newGroupsByWl[src.id])
      // carry the people still waiting (idempotent on waitlist_id+person_id)
      const { data: entries } = await (db.from as any)('waitlist_entries')
        .select('person_id, status, priority, sort_order').eq('waitlist_id', src.id)
      if (entries?.length) {
        await (db.from as any)('waitlist_entries').upsert(
          entries.map((e: any) => ({ org_id: orgId.value, waitlist_id: targetId, person_id: e.person_id, status: e.status, priority: e.priority, sort_order: e.sort_order })),
          { onConflict: 'waitlist_id,person_id' })
      }
    }
  }

  async function cloneOne(
    p: RolloverPlan, targetTerm: OrgTerm, newParentId: string | null,
    schedsBy: Record<string, any[]>, plansBy: Record<string, any[]>,
    feeOptsBy: Record<string, any[]>, feeItemsBy: Record<string, any[]>,
  ): Promise<string> {
    const src = p.source
    const { data: g } = await (db.from as any)('member_groups').insert({
      org_id: orgId.value,
      name: (p.name?.trim() || src.name),
      color: src.color,
      parent_id: newParentId,
      sort_order: src.sort_order ?? 0,
      code_id: src.code_id ?? null,          // keep the class in its programme
      form_id: src.form_id ?? null,          // keep its public registration form
      image_url: src.image_url ?? null,      // keep its hero photo
      code: src.code ?? null,
      age_range: src.age_range ?? null,
      capacity: src.capacity ?? null,
      gender_restriction: src.gender_restriction ?? null,
      term_id: targetTerm.id,
      term_fee: src.term_fee ?? null,
      current_term: targetTerm.name ?? null,   // keep the legacy free-text INFO field in sync
      lineage_id: src.lineage_id || src.id,
      rolled_from_group_id: src.id,
      sub_groups: src.sub_groups ?? [],
    }).select('id').single()
    const newId = g.id as string

    // A source created outside the rollover path has no lineage yet — stamp it
    // with its own id so source and clone share one lineage (matches the 201
    // backfill convention; keeps "already rolled" detection accurate).
    if (!src.lineage_id) await (db.from as any)('member_groups').update({ lineage_id: src.id }).eq('id', src.id)

    // Weekly training schedules carry (events are (re)generated on the group page).
    const scheds = schedsBy[src.id] ?? []
    if (scheds.length) {
      await (db.from as any)('member_group_schedules').insert(scheds.map((s: any) => ({
        org_id: orgId.value, group_id: newId,
        day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time,
        location: s.location, sort_order: s.sort_order ?? 0,
      })))
    }

    // Billing — membership plans carry; a term-fee link for the new term.
    const links = plansBy[src.id] ?? []
    if (links.length) {
      await (db.from as any)('member_group_plans').insert(links.map((l: any) => ({ group_id: newId, plan_id: l.plan_id })))
    }
    await (db.from as any)('member_group_terms').insert({ group_id: newId, term_id: targetTerm.id, fee: src.term_fee ?? null })

    // Fee options (+ their line items) carry to the new group.
    for (const fo of (feeOptsBy[src.id] ?? [])) {
      const { id: _oid, group_id: _g, created_at: _c, ...foRest } = fo
      const { data: newFo } = await (db.from as any)('group_fee_options')
        .insert({ ...foRest, org_id: orgId.value, group_id: newId }).select('id').single()
      const items = feeItemsBy[fo.id] ?? []
      if (items.length) {
        await (db.from as any)('group_fee_option_items').insert(items.map((it: any) => {
          const { id: _iid, option_id: _o, created_at: _ic, ...itRest } = it
          return { ...itRest, option_id: newFo.id }
        }))
      }
    }

    // Staff + members per the chosen mode.
    const people = [
      ...pickPeople(src.staff, p.staffMode, p.staffIds),
      ...pickPeople(src.members, p.memberMode, p.memberIds),
    ]
    if (people.length) {
      await (db.from as any)('member_group_memberships').insert(people.map(person => ({
        group_id: newId,
        person_id: person.id,
        roles: person.roles ?? (person.role ? [person.role] : []),
        role: person.role ?? person.roles?.[0] ?? null,
        sub_group_id: person.sub_group_id ?? null,
        term_id: targetTerm.id,
        start_date: targetTerm.start_date ?? null,
        end_date: targetTerm.end_date ?? null,
        membership_status: 'active',
      })))
    }
    return newId
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
    const [{ data: terms }, { data: groups }] = await Promise.all([
      (db.from as any)('org_terms').select('id, name, start_date, end_date, signup_open, signup_close, set_id, status, sort_order')
        .eq('org_id', orgId.value).order('start_date'),
      (db.from as any)('member_groups').select('id, term_id, lineage_id, rolled_from_group_id, discontinued_at')
        .eq('org_id', orgId.value).not('term_id', 'is', null),
    ])
    const termList = (terms ?? []) as OrgTerm[]
    if (!termList.length || !(groups ?? []).length) return null

    const byTerm: Record<string, { lineages: Set<string>; rolledFrom: Set<string>; count: number }> = {}
    for (const g of (groups ?? []) as any[]) {
      const b = (byTerm[g.term_id] ??= { lineages: new Set(), rolledFrom: new Set(), count: 0 })
      if (!g.discontinued_at) b.count++   // discontinued classes don't count as roll-over work
      if (g.lineage_id) b.lineages.add(g.lineage_id)
      if (g.rolled_from_group_id) b.rolledFrom.add(g.rolled_from_group_id)
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
      const remaining = (groups ?? []).filter((g: any) =>
        g.term_id === t.id
        && !g.discontinued_at
        && (!g.lineage_id || !nextInfo.lineages.has(g.lineage_id))
        && !nextInfo.rolledFrom.has(g.id)).length
      if (remaining > 0) return { state: 'roll', currentTerm: t, nextTerm: next, daysLeft: left, total, remaining }
    }
    return null
  }

  return { mostRecentTermWithGroups, loadTermGroups, lineagesInTerm, rollOverGroups, rolloverNudge, generateTrainingEvents }
}
