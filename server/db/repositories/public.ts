// THE PUBLIC READ SURFACE — the ONLY place anonymous, unauthenticated reads happen.
//
// Everything an unauthenticated visitor can ever see is served from this one file, so
// the entire public exposure surface is auditable in a single review. Rules that hold
// for EVERY function here:
//   • GET / read-only only. No writes. (Public SUBMITS go through the existing
//     /api/public-booking + /api/public-form-submit routes — not this file.)
//   • Filters that gate what's public are HARDCODED here, never taken from the caller:
//     the events list is PUBLISHED + is_public + dated, full stop.
//   • Narrow mappers only. Each function maps raw rows down to a public contract shape,
//     dropping invitees / persons / notes / admin / financial internals / draft content.
//     If a field isn't on the contract, it never leaves.
//
// When the backend team's MySQL API replaces the seam, only this file changes.
import { and, asc, eq, inArray, isNotNull, ne, or } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  PublicOrg,
  PublicEvent,
  PublicEventDetail,
  PublicSession,
  PublicFeeLine,
  PublicDiscount,
  PublicGroup,
  PublicFeeOption,
  PublicForm,
  PublicFormTarget,
  PublicBooker,
  PublicBookerActivity,
  PublicBookerMode,
  PublicBookable,
} from '../../../shared/contracts/public'

// ── value normalisers (same tolerance the other repos use) ──────────────────
function toIso(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString()
  return String(v)
}
function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
function asObj(v: unknown): Record<string, any> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, any>
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      return p && typeof p === 'object' && !Array.isArray(p) ? p : {}
    } catch {
      return {}
    }
  }
  return {}
}
function asArray(v: unknown): any[] {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      return Array.isArray(p) ? p : []
    } catch {
      return []
    }
  }
  return []
}

// A person on a class roster is "staff-ish" when any of their roles reads like a
// coach/manager — the same heuristic the public-form-submit path uses. Only used to
// EXCLUDE staff from a member headcount; no person data leaves the seam.
function isStaffish(row: { role?: unknown; roles?: unknown }): boolean {
  const keys = [row.role, ...asArray(row.roles)]
    .filter(Boolean)
    .map((k) => String(k).toLowerCase())
  return keys.some((k) => k.includes('coach') || k.includes('manager') || k === 'staff')
}

// ── fee-option label maths (pure copy of useGroupFees so the client renders a group
// fee with no pricing logic or knowledge of the fee model) ──────────────────────
function fmtMoney(v: number, currency = 'NZD'): string {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)
  } catch {
    return `$${v}`
  }
}
function optionTotal(items: { amount: unknown }[]): number {
  return (items || []).reduce((s, i) => s + num(i.amount), 0)
}
function feeLabel(o: any, total: number, currency: string): string {
  const money = fmtMoney(total, currency)
  if (o.feeType === 'recurring') {
    const unit = o.periodUnit || 'month'
    const n = o.periodCount || 1
    return n === 1 ? `${money} / ${unit}` : `${money} / ${n} ${unit}s`
  }
  if (o.feeType === 'instalment') {
    const n = o.instalmentCount || 1
    const each = n ? total / n : total
    return `${money} · ${n}× ${fmtMoney(each, currency)}`
  }
  if (o.feeType === 'concession') {
    const n = o.sessionCount || 0
    return `${money} · ${n} session${n === 1 ? '' : 's'}`
  }
  if (o.feeType === 'per_session') return `${money} / session`
  return o.prorata ? `${money} · pro-rata` : money
}

// Load + shape a set of groups' fee OPTIONS into ready-to-render public shapes,
// keyed by group id. One options query + one items query, no N+1.
async function feeOptionsByGroup(groupIds: string[], currency: string): Promise<Record<string, PublicFeeOption[]>> {
  const out: Record<string, PublicFeeOption[]> = {}
  if (!groupIds.length) return out
  const opts = await db
    .select()
    .from(schema.groupFeeOptions)
    .where(inArray(schema.groupFeeOptions.groupId, groupIds))
    .orderBy(asc(schema.groupFeeOptions.sortOrder))
  const optIds = opts.map((o) => o.id)
  const items = optIds.length
    ? await db.select().from(schema.groupFeeOptionItems).where(inArray(schema.groupFeeOptionItems.optionId, optIds))
    : []
  const itemsByOpt: Record<string, any[]> = {}
  for (const it of items) (itemsByOpt[it.optionId] ??= []).push(it)
  for (const o of opts) {
    const its = itemsByOpt[o.id] ?? []
    const total = optionTotal(its)
    ;(out[o.groupId] ??= []).push({
      id: o.id,
      name: (o.name?.trim() || 'Fee'),
      label: feeLabel(o, total, currency),
      total,
      description: o.description ?? null,
    })
  }
  return out
}

// The member (non-staff) headcount per group — for capacity/spaces. No person leaves.
async function memberCountsByGroup(groupIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  if (!groupIds.length) return out
  const rows = await db
    .select({ groupId: schema.memberGroupMemberships.groupId, role: schema.memberGroupMemberships.role, roles: schema.memberGroupMemberships.roles })
    .from(schema.memberGroupMemberships)
    .where(inArray(schema.memberGroupMemberships.groupId, groupIds))
  for (const r of rows) if (!isStaffish(r)) out[r.groupId] = (out[r.groupId] ?? 0) + 1
  return out
}

// ── Org ─────────────────────────────────────────────────────────────────────
export async function publicOrg(orgId: string): Promise<PublicOrg | null> {
  const [r] = await db.select().from(schema.organisations).where(eq(schema.organisations.id, orgId)).limit(1)
  if (!r) return null
  return {
    id: r.id,
    name: r.name,
    brandColor: r.brandColor ?? null,
    brandTextColor: r.brandTextColor ?? null,
    logoUrl: r.logoUrl ?? null,
    currency: r.currency ?? 'NZD',
    bookerTheme: asObj(r.bookerTheme),
  }
}

// ── Events list (PUBLISHED + public + dated — hardcoded, not from the query) ──
// Optional venue/category/type narrowing mirrors the embed-calendar's client filter,
// applied here so the internal fields it keys off (bookable_id, locations, style) are
// filtered on server-side and NEVER leave the seam.
export async function publicEvents(
  orgId: string,
  opts: { venues?: string[]; categories?: string[]; types?: string[] } = {},
): Promise<PublicEvent[]> {
  const rows = await db
    .select({
      id: schema.events.id,
      title: schema.events.title,
      startAt: schema.events.startAt,
      endAt: schema.events.endAt,
      isAllDay: schema.events.isAllDay,
      locationType: schema.events.locationType,
      address: schema.events.address,
      description: schema.events.description,
      bannerUrl: schema.events.bannerUrl,
      formId: schema.events.formId,
      categoryId: schema.events.categoryId,
      // internal-only, used for filtering then dropped:
      style: schema.events.style,
      bookableId: schema.events.bookableId,
      locations: schema.events.locations,
      categoryColor: schema.categories.color,
    })
    .from(schema.events)
    .leftJoin(schema.categories, eq(schema.events.categoryId, schema.categories.id))
    .where(
      and(
        eq(schema.events.orgId, orgId),
        eq(schema.events.status, 'PUBLISHED'),
        eq(schema.events.isPublic, true),
        // An undated event has nowhere to sit on a public calendar (the staff calendar
        // parks those on today; a public surface must not invent a date).
        isNotNull(schema.events.startAt),
      ),
    )
    .orderBy(asc(schema.events.startAt))

  const venues = opts.venues ?? []
  const categories = opts.categories ?? []
  const types = opts.types ?? []

  const filtered = rows.filter((e) => {
    if (categories.length && !(e.categoryId && categories.includes(e.categoryId))) return false
    if (types.length && !types.includes(e.style ?? 'BASIC')) return false
    if (venues.length) {
      const ids: string[] = []
      if (e.bookableId) ids.push(e.bookableId)
      for (const loc of asArray(e.locations)) if (Array.isArray(loc?.bookable_ids)) ids.push(...loc.bookable_ids)
      if (!ids.some((id) => venues.includes(id))) return false
    }
    return true
  })

  // Narrow map — bookableId / locations / style are dropped here, never exposed.
  return filtered.map((e) => ({
    id: e.id,
    title: e.title,
    startAt: toIso(e.startAt)!,
    endAt: toIso(e.endAt),
    isAllDay: !!e.isAllDay,
    locationType: e.locationType,
    address: e.address ?? null,
    description: e.description ?? null,
    bannerUrl: e.bannerUrl ?? null,
    formId: e.formId ?? null,
    categoryId: e.categoryId ?? null,
    categoryColor: e.categoryColor ?? null,
  }))
}

// ── One event + registration detail ─────────────────────────────────────────
// The registration page loads an event by id (the id is the capability — a shared
// registration link). Served unless CANCELLED/ARCHIVED (mirrors the live page);
// returns null when not found OR closed so a closed event is indistinguishable from a
// nonexistent one. Bundles sessions + fee lines + active discounts + the linked form
// config so the renderer has everything in one call.
export async function publicEvent(id: string): Promise<PublicEventDetail | null> {
  const [ev] = await db.select().from(schema.events).where(eq(schema.events.id, id)).limit(1)
  if (!ev) return null
  if (ev.status === 'CANCELLED' || ev.status === 'ARCHIVED') return null

  const currency = (await orgCurrency(ev.orgId)) ?? 'NZD'

  // Sessions + fee components. Per-session fee_components are keyed by session_id (the
  // wizard doesn't stamp event_id on them), so fetch by event_id OR the session ids.
  const sessRows = await db
    .select({
      id: schema.sessions.id,
      title: schema.sessions.title,
      startAt: schema.sessions.startAt,
      isRequired: schema.sessions.isRequired,
      displayOnForm: schema.sessions.displayOnForm,
    })
    .from(schema.sessions)
    .where(eq(schema.sessions.eventId, id))
    .orderBy(asc(schema.sessions.sortOrder))
  const sessionIds = sessRows.map((s) => s.id)

  const feeRows = await db
    .select({ name: schema.feeComponents.name, amount: schema.feeComponents.amount, sessionId: schema.feeComponents.sessionId, eventId: schema.feeComponents.eventId })
    .from(schema.feeComponents)
    .where(
      sessionIds.length
        ? or(eq(schema.feeComponents.eventId, id), inArray(schema.feeComponents.sessionId, sessionIds))
        : eq(schema.feeComponents.eventId, id),
    )

  const feeBySession: Record<string, number> = {}
  const feeLineItems: PublicFeeLine[] = []
  for (const f of feeRows) {
    if (f.sessionId) feeBySession[f.sessionId] = (feeBySession[f.sessionId] ?? 0) + num(f.amount)
    else feeLineItems.push({ name: f.name, amount: num(f.amount) })
  }
  const sessions: PublicSession[] = sessRows.map((s) => ({
    id: s.id,
    title: s.title,
    startAt: toIso(s.startAt),
    required: !!s.isRequired,
    display: s.displayOnForm !== false,
    fee: feeBySession[s.id] ?? 0,
  }))

  // Active discounts — display-safe fields only.
  const discRows = await db
    .select({ name: schema.discounts.name, formText: schema.discounts.formText, modifierType: schema.discounts.modifierType, modifierValue: schema.discounts.modifierValue })
    .from(schema.discounts)
    .where(and(eq(schema.discounts.eventId, id), eq(schema.discounts.isActive, true)))
  const discounts: PublicDiscount[] = discRows.map((d) => ({
    name: d.name,
    formText: d.formText ?? null,
    modifierType: d.modifierType,
    modifierValue: num(d.modifierValue),
  }))

  const form = ev.formId ? await formConfigById(ev.formId) : null

  return {
    id: ev.id,
    orgId: ev.orgId,
    title: ev.title,
    startAt: toIso(ev.startAt)!,
    endAt: toIso(ev.endAt),
    isAllDay: !!ev.isAllDay,
    locationType: ev.locationType,
    address: ev.address ?? null,
    description: ev.description ?? null,
    bannerUrl: ev.bannerUrl ?? null,
    formId: ev.formId ?? null,
    categoryId: ev.categoryId ?? null,
    categoryColor: null,
    formConfig: form?.config ?? null,
    formName: form?.name ?? null,
    sessions,
    feeLineItems,
    discounts,
    ageMin: ev.ageMin ?? null,
    ageMax: ev.ageMax ?? null,
  }
}

// ── One group + registration detail ─────────────────────────────────────────
export async function publicGroup(id: string): Promise<PublicGroup | null> {
  const [g] = await db
    .select({
      id: schema.memberGroups.id,
      orgId: schema.memberGroups.orgId,
      name: schema.memberGroups.name,
      imageUrl: schema.memberGroups.imageUrl,
      formId: schema.memberGroups.formId,
      capacity: schema.memberGroups.capacity,
      waitlistId: schema.memberGroups.waitlistId,
    })
    .from(schema.memberGroups)
    .where(eq(schema.memberGroups.id, id))
    .limit(1)
  if (!g) return null

  const currency = (await orgCurrency(g.orgId)) ?? 'NZD'
  const feeMap = await feeOptionsByGroup([g.id], currency)

  // Capacity status (never the roster).
  let full = false
  let waitlistName: string | null = null
  const siblingsWithSpace: { id: string; name: string; spaces: number | null; formId: string | null }[] = []
  if (g.capacity != null) {
    const counts = await memberCountsByGroup([g.id])
    if ((counts[g.id] ?? 0) >= g.capacity) {
      full = true
      if (g.waitlistId) {
        const [w] = await db.select({ name: schema.waitlists.name }).from(schema.waitlists).where(eq(schema.waitlists.id, g.waitlistId)).limit(1)
        waitlistName = w?.name ?? null
        const sibs = await db
          .select({ id: schema.memberGroups.id, name: schema.memberGroups.name, capacity: schema.memberGroups.capacity, formId: schema.memberGroups.formId })
          .from(schema.memberGroups)
          .where(and(eq(schema.memberGroups.waitlistId, g.waitlistId), ne(schema.memberGroups.id, g.id)))
        const sibCounts = await memberCountsByGroup(sibs.map((s) => s.id))
        for (const s of sibs) {
          const spaces = s.capacity == null ? null : s.capacity - (sibCounts[s.id] ?? 0)
          if (spaces == null || spaces > 0) siblingsWithSpace.push({ id: s.id, name: s.name, spaces, formId: s.formId ?? null })
        }
      }
    }
  }

  return {
    id: g.id,
    orgId: g.orgId,
    name: g.name,
    imageUrl: g.imageUrl ?? null,
    formId: g.formId ?? null,
    feeOptions: feeMap[g.id] ?? [],
    full,
    waitlistName,
    siblingsWithSpace,
  }
}

// ── A form + its connected classes ──────────────────────────────────────────
// registration_form_targets → member_groups, expanding CODE/programme targets to
// every class in the subtree (dynamic — classes added later appear automatically),
// excluding classes whose effective term has already ended. Each class carries live
// spaces + fee options + its code (section) label.
export async function publicForm(formId: string): Promise<PublicForm | null> {
  const [f] = await db.select().from(schema.registrationForms).where(eq(schema.registrationForms.id, formId)).limit(1)
  if (!f) return null
  const orgId = f.orgId
  const currency = (await orgCurrency(orgId)) ?? 'NZD'

  const tgtRows = await db
    .select({ targetType: schema.registrationFormTargets.targetType, targetId: schema.registrationFormTargets.targetId })
    .from(schema.registrationFormTargets)
    .where(eq(schema.registrationFormTargets.formId, formId))

  const targets = await resolveFormTargets(orgId, currency, tgtRows)

  return {
    id: f.id,
    orgId,
    name: f.name,
    config: asObj(f.config),
    targets,
  }
}

// Shared resolver: given the raw target rows, expand codes, prune ended terms, order
// by code tree, attach spaces + fee options. Pure of any auth.
async function resolveFormTargets(
  orgId: string,
  currency: string,
  tgtRows: { targetType: string; targetId: string }[],
): Promise<PublicFormTarget[]> {
  const groupIds = tgtRows.filter((t) => t.targetType === 'group').map((t) => t.targetId)
  const codeIds = tgtRows.filter((t) => t.targetType === 'code').map((t) => t.targetId)
  if (!groupIds.length && !codeIds.length) return []

  const [codes, terms] = await Promise.all([
    db.select({ id: schema.groupCodes.id, name: schema.groupCodes.name, parentId: schema.groupCodes.parentId, termId: schema.groupCodes.termId, sortOrder: schema.groupCodes.sortOrder }).from(schema.groupCodes).where(eq(schema.groupCodes.orgId, orgId)),
    db.select({ id: schema.orgTerms.id, endDate: schema.orgTerms.endDate }).from(schema.orgTerms).where(eq(schema.orgTerms.orgId, orgId)),
  ])
  const codesById: Record<string, any> = {}
  const codeChildren: Record<string, string[]> = {}
  for (const c of codes) { codesById[c.id] = c; if (c.parentId) (codeChildren[c.parentId] ??= []).push(c.id) }

  // Expand every code target to its whole subtree.
  const expandedCodes = new Set<string>()
  const stack = [...codeIds]
  while (stack.length) {
    const id = stack.pop()!
    if (expandedCodes.has(id)) continue
    expandedCodes.add(id)
    for (const k of codeChildren[id] ?? []) stack.push(k)
  }

  const [byId, byCode] = await Promise.all([
    groupIds.length
      ? db.select({ id: schema.memberGroups.id, name: schema.memberGroups.name, capacity: schema.memberGroups.capacity, waitlistId: schema.memberGroups.waitlistId, codeId: schema.memberGroups.codeId, termId: schema.memberGroups.termId }).from(schema.memberGroups).where(inArray(schema.memberGroups.id, groupIds))
      : Promise.resolve([] as any[]),
    expandedCodes.size
      ? db.select({ id: schema.memberGroups.id, name: schema.memberGroups.name, capacity: schema.memberGroups.capacity, waitlistId: schema.memberGroups.waitlistId, codeId: schema.memberGroups.codeId, termId: schema.memberGroups.termId }).from(schema.memberGroups).where(inArray(schema.memberGroups.codeId, [...expandedCodes]))
      : Promise.resolve([] as any[]),
  ])
  const seen = new Set<string>()
  let groups = [...byId, ...byCode].filter((g: any) => !seen.has(g.id) && seen.add(g.id))

  // Drop history classes (effective term already ended). Term-less classes always show.
  const termEnd: Record<string, string | null> = {}
  for (const t of terms) termEnd[t.id] = t.endDate ? String(t.endDate).slice(0, 10) : null
  const effectiveTermId = (g: any): string | null => {
    if (g.termId) return g.termId
    let c = g.codeId ? codesById[g.codeId] : null
    while (c) { if (c.termId) return c.termId; c = c.parentId ? codesById[c.parentId] : null }
    return null
  }
  const today = new Date().toISOString().slice(0, 10)
  groups = groups.filter((g: any) => {
    const end = termEnd[effectiveTermId(g) ?? ''] ?? null
    return !end || end >= today
  })
  if (!groups.length) return []

  // Order by code tree walk, name within a section.
  const codeOrder: Record<string, number> = {}
  {
    const roots = codes
      .filter((c: any) => !c.parentId || !codesById[c.parentId])
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
    let i = 0
    const walk = (c: any) => {
      codeOrder[c.id] = i++
      const kids = (codeChildren[c.id] ?? []).map((k) => codesById[k]).sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
      kids.forEach(walk)
    }
    roots.forEach(walk)
  }
  groups.sort((a: any, b: any) => (codeOrder[a.codeId] ?? 9999) - (codeOrder[b.codeId] ?? 9999) || a.name.localeCompare(b.name))

  const ids = groups.map((g: any) => g.id)
  const [counts, feeMap] = await Promise.all([memberCountsByGroup(ids), feeOptionsByGroup(ids, currency)])

  return groups.map((g: any) => {
    const taken = counts[g.id] ?? 0
    const full = g.capacity != null && taken >= g.capacity
    return {
      id: g.id,
      name: g.name,
      section: g.codeId ? (codesById[g.codeId]?.name ?? null) : null,
      spaces: g.capacity == null ? null : Math.max(0, g.capacity - taken),
      full,
      waitlistable: !!g.waitlistId,
      feeOptions: feeMap[g.id] ?? [],
    }
  })
}

// ── Booker (the public /book menu + booking-flow data) ──────────────────────
export async function publicBooker(orgId: string): Promise<PublicBooker | null> {
  const org = await publicOrg(orgId)
  if (!org) return null

  // Bookings-enabled, ACTIVE public activities.
  const actRows = await db
    .select()
    .from(schema.activities)
    .where(and(eq(schema.activities.orgId, orgId), eq(schema.activities.status, 'ACTIVE'), ne(schema.activities.bookingsEnabled, false)))
    .orderBy(asc(schema.activities.sortOrder), asc(schema.activities.name))
  const actIds = actRows.map((a) => a.id)

  const modeRows = actIds.length
    ? await db
        .select({ id: schema.activityModes.id, name: schema.activityModes.name, activityId: schema.activityModes.activityId, category: schema.activityModes.category, periodPrice: schema.activityModes.periodPrice, periodUnit: schema.activityModes.periodUnit })
        .from(schema.activityModes)
        .where(inArray(schema.activityModes.activityId, actIds))
        .orderBy(asc(schema.activityModes.sortOrder), asc(schema.activityModes.name))
    : []
  const modesByActivity: Record<string, PublicBookerMode[]> = {}
  for (const m of modeRows) {
    ;(modesByActivity[m.activityId] ??= []).push({
      id: m.id,
      name: m.name,
      activityId: m.activityId,
      category: m.category ?? null,
      periodPrice: m.periodPrice != null ? num(m.periodPrice) : null,
      periodUnit: m.periodUnit ?? null,
    })
  }
  const activities: PublicBookerActivity[] = actRows.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description ?? null,
    color: a.color ?? null,
    icon: a.icon ?? null,
    imageUrl: a.imageUrl ?? null,
    bookingFlow: a.bookingFlow,
    status: a.status,
    bookingsEnabled: !!a.bookingsEnabled,
    staffBookableId: a.staffBookableId ?? null,
    modes: modesByActivity[a.id] ?? [],
  }))

  // Public bookables (for the booking-flow grid) — public-safe presentation + tree
  // fields only. Never internal names, access hardware, rules, or custom fields.
  const bkRows = await db
    .select({ id: schema.bookables.id, name: schema.bookables.name, type: schema.bookables.type, parentId: schema.bookables.parentId, masterId: schema.bookables.masterId, maxConcurrent: schema.bookables.maxConcurrent, mainImage: schema.bookables.mainImage, isPublic: schema.bookables.isPublic })
    .from(schema.bookables)
    .where(and(eq(schema.bookables.orgId, orgId), eq(schema.bookables.isPublic, true)))
    .orderBy(asc(schema.bookables.sortOrder))
  const bookables: PublicBookable[] = bkRows.map((b) => ({
    id: b.id,
    name: b.name,
    type: b.type,
    parentId: b.parentId ?? null,
    masterId: b.masterId ?? null,
    maxConcurrent: num(b.maxConcurrent),
    mainImage: b.mainImage ?? null,
  }))

  // Availability rules for those bookables (open hours — public by nature). Emitted in
  // the snake_case shape the calendar reads directly, dropping targeting internals
  // (eligibility / membership_types / group_ids / invitee_*).
  const bkIds = bkRows.map((b) => b.id)
  const availRows = bkIds.length
    ? await db.select().from(schema.availabilityRules).where(and(inArray(schema.availabilityRules.bookableId, bkIds), eq(schema.availabilityRules.isActive, true))).orderBy(asc(schema.availabilityRules.sortOrder))
    : []
  const availability = availRows.map((r) => ({
    id: r.id,
    bookable_id: r.bookableId,
    name: r.name,
    rule_type: r.ruleType,
    days_of_week: asArray(r.daysOfWeek),
    time_from: r.timeFrom ?? null,
    time_to: r.timeTo ?? null,
    time_slots: asArray(r.timeSlots),
    week_interval: r.weekInterval,
    week_anchor: r.weekAnchor ? String(r.weekAnchor).slice(0, 10) : null,
    month_week: r.monthWeek ?? null,
    rrule: r.rrule ?? null,
    bookable_mode_id: r.bookableModeId ?? null,
    activity_mode_ids: asArray(r.activityModeIds),
    max_concurrent: r.maxConcurrent ?? null,
    valid_from: r.validFrom ? String(r.validFrom).slice(0, 10) : null,
    valid_until: r.validUntil ? String(r.validUntil).slice(0, 10) : null,
    sort_order: r.sortOrder,
    is_active: !!r.isActive,
    color: r.color,
  }))

  return { org, activities, bookables, availability }
}

// ── internal helpers ────────────────────────────────────────────────────────
async function orgCurrency(orgId: string): Promise<string | null> {
  const [r] = await db.select({ currency: schema.organisations.currency }).from(schema.organisations).where(eq(schema.organisations.id, orgId)).limit(1)
  return r?.currency ?? null
}

async function formConfigById(formId: string): Promise<{ config: Record<string, any>; name: string } | null> {
  const [f] = await db.select({ config: schema.registrationForms.config, name: schema.registrationForms.name }).from(schema.registrationForms).where(eq(schema.registrationForms.id, formId)).limit(1)
  if (!f) return null
  return { config: asObj(f.config), name: f.name }
}
