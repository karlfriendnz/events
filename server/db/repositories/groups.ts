// The repository: the ONLY code that knows how groups are stored. It turns DB rows
// into domain objects (the contract shape) and back. Nitro routes call these
// functions; they never touch Drizzle or the DB directly. When the backend team's
// MySQL API replaces this, only this file changes — routes, composables and UI are
// untouched.
//
// json handling: sub_groups / location_ids / roles / positions / member_positions /
// role_minimums / a schedule's location are `json` columns. mysql2 usually hands
// them back already parsed, but a driver/config can return the raw string — the
// `asArray` / `asObj` / `asJson` helpers normalise either form (and never throw), so
// the domain always sees a real JS array / object / value.
import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  MemberGroup,
  GroupCode,
  MemberGroupMembership,
  MemberGroupSchedule,
  GroupFeeOption,
  GroupFeeOptionItem,
  MemberGroupCreate,
  MemberGroupPatch,
  GroupCodeCreate,
  GroupCodePatch,
  GroupView,
  GroupViewCreate,
  GroupViewPatch,
} from '../../../shared/contracts/group'

// Coerce a json column into string[]: already an array → use it; a string → parse;
// anything else / a parse failure → [].
function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? (parsed as string[]) : []
    } catch {
      return []
    }
  }
  return []
}

// Coerce a json column into an object: already an object → use it; a string → parse;
// anything else / a parse failure → {}.
function asObj(v: unknown): Record<string, any> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, any>
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

// Coerce a json column into its parsed value, leaving non-string payloads as-is.
function asJson(v: unknown): any {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v)
    } catch {
      return v
    }
  }
  return v ?? null
}

function toGroup(r: typeof schema.memberGroups.$inferSelect): MemberGroup {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    color: r.color ?? null,
    codeId: r.codeId ?? null,
    termId: r.termId ?? null,
    capacity: r.capacity ?? null,
    ageRange: r.ageRange ?? null,
    genderRestriction: r.genderRestriction ?? null,
    subGroups: asJson(r.subGroups) ?? [],
    locationIds: asArray(r.locationIds),
    locationId: r.locationId ?? null,
    waitlistId: r.waitlistId ?? null,
    kind: r.kind,
    formId: r.formId ?? null,
    imageUrl: r.imageUrl ?? null,
    sortOrder: r.sortOrder,
    lineageId: r.lineageId ?? null,
    rolledFromGroupId: r.rolledFromGroupId ?? null,
    discontinuedAt: r.discontinuedAt instanceof Date ? r.discontinuedAt.toISOString() : (r.discontinuedAt ?? null),
    membershipSettings: asJson(r.membershipSettings),
    code: r.code ?? null,
    currentTerm: r.currentTerm ?? null,
    termFee: r.termFee ?? null,
    headPersonId: r.headPersonId ?? null,
    parentId: r.parentId ?? null,
  }
}

function toCode(r: typeof schema.groupCodes.$inferSelect): GroupCode {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    color: r.color ?? null,
    parentId: r.parentId ?? null,
    termId: r.termId ?? null,
    sortOrder: r.sortOrder,
    roleMinimums: asObj(r.roleMinimums),
    memberPositions: asArray(r.memberPositions),
    positionMinimums: asObj(r.positionMinimums),
    memberTypeKey: r.memberTypeKey ?? null,
    sportId: r.sportId ?? null,
    lineageId: r.lineageId ?? null,
  }
}

function toMembership(r: typeof schema.memberGroupMemberships.$inferSelect): MemberGroupMembership {
  return {
    groupId: r.groupId,
    personId: r.personId,
    role: r.role ?? null,
    roles: asArray(r.roles),
    positions: asArray(r.positions),
    subGroupId: r.subGroupId ?? null,
    termId: r.termId ?? null,
  }
}

function toSchedule(r: typeof schema.memberGroupSchedules.$inferSelect): MemberGroupSchedule {
  return {
    id: r.id,
    orgId: r.orgId,
    groupId: r.groupId,
    name: r.name ?? null,
    dayOfWeek: r.dayOfWeek,
    startTime: String(r.startTime),
    endTime: String(r.endTime),
    location: asJson(r.location),
    sortOrder: r.sortOrder,
  }
}

function toFeeItem(r: typeof schema.groupFeeOptionItems.$inferSelect): GroupFeeOptionItem {
  return {
    id: r.id,
    optionId: r.optionId,
    name: r.name ?? null,
    amount: r.amount ?? null,
    account: r.account ?? null,
    sortOrder: r.sortOrder ?? null,
  }
}

function toFeeOption(
  r: typeof schema.groupFeeOptions.$inferSelect,
  items: GroupFeeOptionItem[],
): GroupFeeOption {
  return {
    id: r.id,
    orgId: r.orgId,
    groupId: r.groupId,
    name: r.name,
    feeType: r.feeType,
    periodUnit: r.periodUnit ?? null,
    periodCount: r.periodCount ?? null,
    autoRenew: r.autoRenew ?? null,
    instalmentCount: r.instalmentCount ?? null,
    sessionCount: r.sessionCount ?? null,
    prorata: r.prorata ?? null,
    description: r.description ?? null,
    status: r.status,
    dueDate: r.dueDate ? String(r.dueDate).slice(0, 10) : null,
    depositPercent: r.depositPercent ?? null,
    sortOrder: r.sortOrder ?? null,
    items,
  }
}

/** Every group an org has, in author order. */
export async function listGroups(orgId: string): Promise<MemberGroup[]> {
  const rows = await db
    .select()
    .from(schema.memberGroups)
    .where(eq(schema.memberGroups.orgId, orgId))
    .orderBy(asc(schema.memberGroups.sortOrder))
  return rows.map(toGroup)
}

/** One group by id, or null when it doesn't exist. */
export async function getGroup(id: string): Promise<MemberGroup | null> {
  const [r] = await db
    .select()
    .from(schema.memberGroups)
    .where(eq(schema.memberGroups.id, id))
    .limit(1)
  return r ? toGroup(r) : null
}

/** Every code an org has defined, in author order. */
export async function listCodes(orgId: string): Promise<GroupCode[]> {
  const rows = await db
    .select()
    .from(schema.groupCodes)
    .where(eq(schema.groupCodes.orgId, orgId))
    .orderBy(asc(schema.groupCodes.sortOrder))
  return rows.map(toCode)
}

/** The roster of one group (its `member_group_memberships` rows). */
export async function listMemberships(groupId: string): Promise<MemberGroupMembership[]> {
  const rows = await db
    .select()
    .from(schema.memberGroupMemberships)
    .where(eq(schema.memberGroupMemberships.groupId, groupId))
  return rows.map(toMembership)
}

/** The weekly training schedules of one group, in author order. */
export async function listSchedules(groupId: string): Promise<MemberGroupSchedule[]> {
  const rows = await db
    .select()
    .from(schema.memberGroupSchedules)
    .where(eq(schema.memberGroupSchedules.groupId, groupId))
    .orderBy(asc(schema.memberGroupSchedules.sortOrder))
  return rows.map(toSchedule)
}

/** The weekly training schedules across MANY groups (Week View / class finder). */
export async function listSchedulesForGroups(groupIds: string[]): Promise<MemberGroupSchedule[]> {
  if (groupIds.length === 0) return []
  const rows = await db
    .select()
    .from(schema.memberGroupSchedules)
    .where(inArray(schema.memberGroupSchedules.groupId, groupIds))
    .orderBy(asc(schema.memberGroupSchedules.sortOrder))
  return rows.map(toSchedule)
}

/**
 * The fee options of one group, each hydrated with its line items. Two queries (the
 * options, then all their items) joined in memory — no PostgREST embedded select on
 * MySQL. Ordered by sortOrder throughout.
 */
export async function listFeeOptions(groupId: string): Promise<GroupFeeOption[]> {
  const optionRows = await db
    .select()
    .from(schema.groupFeeOptions)
    .where(eq(schema.groupFeeOptions.groupId, groupId))
    .orderBy(asc(schema.groupFeeOptions.sortOrder))
  if (optionRows.length === 0) return []

  const itemsByOption = new Map<string, GroupFeeOptionItem[]>()
  for (const o of optionRows) {
    const itemRows = await db
      .select()
      .from(schema.groupFeeOptionItems)
      .where(eq(schema.groupFeeOptionItems.optionId, o.id))
      .orderBy(asc(schema.groupFeeOptionItems.sortOrder))
    itemsByOption.set(o.id, itemRows.map(toFeeItem))
  }

  return optionRows.map((o) => toFeeOption(o, itemsByOption.get(o.id) ?? []))
}

// One code by id, or null — used to re-read a code after a write and map it through
// the same toCode as the list reads (there's no public getCode in the read API).
async function loadCode(id: string): Promise<GroupCode | null> {
  const [r] = await db.select().from(schema.groupCodes).where(eq(schema.groupCodes.id, id)).limit(1)
  return r ? toCode(r) : null
}

// ── Writes ──
// The repo owns the id (MySQL can't default a uuid). `as any` on the insert values:
// the first-pass schema marks columns .notNull() without their DB defaults, so
// Drizzle's insert type over-requires them; consistent with the app's (db.from as any)
// idiom. NB the json() columns (subGroups/locationIds/roleMinimums/memberPositions)
// take a RAW JS array/object — Drizzle's json type serialises it on the way in
// (mirroring the asArray/asObj parse on the way out); a JSON.stringify here would
// double-encode and read back as a string.
export async function createGroup(input: MemberGroupCreate): Promise<MemberGroup> {
  const id = randomUUID()
  await db.insert(schema.memberGroups).values({
    id,
    orgId: input.orgId,
    name: input.name,
    color: input.color ?? null,
    codeId: input.codeId ?? null,
    termId: input.termId ?? null,
    capacity: input.capacity ?? null,
    ageRange: input.ageRange ?? null,
    genderRestriction: input.genderRestriction ?? null,
    subGroups: input.subGroups ?? [],
    locationIds: input.locationIds ?? [],
    locationId: input.locationId ?? null,
    waitlistId: input.waitlistId ?? null,
    kind: input.kind ?? 'class',
    formId: input.formId ?? null,
    imageUrl: input.imageUrl ?? null,
    sortOrder: input.sortOrder ?? 0,
    lineageId: input.lineageId ?? null,
    rolledFromGroupId: input.rolledFromGroupId ?? null,
    discontinuedAt: input.discontinuedAt ?? null,
    membershipSettings: input.membershipSettings ?? null,
    code: input.code ?? null,
    currentTerm: input.currentTerm ?? null,
    termFee: input.termFee ?? null,
    headPersonId: input.headPersonId ?? null,
    parentId: input.parentId ?? null,
  } as any)
  return (await getGroup(id))!
}

export async function updateGroup(id: string, patch: MemberGroupPatch): Promise<MemberGroup | null> {
  const set: Record<string, any> = {}
  if (patch.name !== undefined) set.name = patch.name
  if (patch.color !== undefined) set.color = patch.color
  if (patch.codeId !== undefined) set.codeId = patch.codeId
  if (patch.termId !== undefined) set.termId = patch.termId
  if (patch.capacity !== undefined) set.capacity = patch.capacity
  if (patch.ageRange !== undefined) set.ageRange = patch.ageRange
  if (patch.genderRestriction !== undefined) set.genderRestriction = patch.genderRestriction
  if (patch.subGroups !== undefined) set.subGroups = patch.subGroups
  if (patch.locationIds !== undefined) set.locationIds = patch.locationIds
  if (patch.locationId !== undefined) set.locationId = patch.locationId
  if (patch.waitlistId !== undefined) set.waitlistId = patch.waitlistId
  if (patch.kind !== undefined) set.kind = patch.kind
  if (patch.formId !== undefined) set.formId = patch.formId
  if (patch.imageUrl !== undefined) set.imageUrl = patch.imageUrl
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (patch.lineageId !== undefined) set.lineageId = patch.lineageId
  if (patch.rolledFromGroupId !== undefined) set.rolledFromGroupId = patch.rolledFromGroupId
  // timestamp column — accept an ISO string or null, coerce a string to a Date.
  if (patch.discontinuedAt !== undefined)
    set.discontinuedAt = patch.discontinuedAt ? new Date(patch.discontinuedAt) : null
  if (patch.membershipSettings !== undefined) set.membershipSettings = patch.membershipSettings
  if (patch.code !== undefined) set.code = patch.code
  if (patch.currentTerm !== undefined) set.currentTerm = patch.currentTerm
  if (patch.termFee !== undefined) set.termFee = patch.termFee
  if (patch.headPersonId !== undefined) set.headPersonId = patch.headPersonId
  if (patch.parentId !== undefined) set.parentId = patch.parentId
  if (Object.keys(set).length) await db.update(schema.memberGroups).set(set).where(eq(schema.memberGroups.id, id))
  return getGroup(id)
}

export async function deleteGroup(id: string): Promise<void> {
  await db.delete(schema.memberGroups).where(eq(schema.memberGroups.id, id))
}

export async function createCode(input: GroupCodeCreate): Promise<GroupCode> {
  const id = randomUUID()
  await db.insert(schema.groupCodes).values({
    id,
    orgId: input.orgId,
    name: input.name,
    color: input.color ?? null,
    parentId: input.parentId ?? null,
    termId: input.termId ?? null,
    sortOrder: input.sortOrder ?? 0,
    roleMinimums: input.roleMinimums ?? {},
    memberPositions: input.memberPositions ?? [],
    positionMinimums: input.positionMinimums ?? {},
    memberTypeKey: input.memberTypeKey ?? null,
    sportId: input.sportId ?? null,
    // A new code's lineage defaults to its own id (stable identity for rollover).
    lineageId: input.lineageId ?? id,
  } as any)
  return (await loadCode(id))!
}

export async function updateCode(id: string, patch: GroupCodePatch): Promise<GroupCode | null> {
  const set: Record<string, any> = {}
  if (patch.name !== undefined) set.name = patch.name
  if (patch.color !== undefined) set.color = patch.color
  if (patch.parentId !== undefined) set.parentId = patch.parentId
  if (patch.termId !== undefined) set.termId = patch.termId
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (patch.roleMinimums !== undefined) set.roleMinimums = patch.roleMinimums
  if (patch.memberPositions !== undefined) set.memberPositions = patch.memberPositions
  if (patch.positionMinimums !== undefined) set.positionMinimums = patch.positionMinimums
  if (patch.memberTypeKey !== undefined) set.memberTypeKey = patch.memberTypeKey
  if (patch.sportId !== undefined) set.sportId = patch.sportId
  if (patch.lineageId !== undefined) set.lineageId = patch.lineageId
  if (Object.keys(set).length) await db.update(schema.groupCodes).set(set).where(eq(schema.groupCodes.id, id))
  return loadCode(id)
}

// Delete a code, re-homing its contents to the deleted code's parent so nothing is
// orphaned: child GROUPS move up to parent_id (code_id), child CODES re-parent
// likewise, and the code's own staff config (code_role_defs + code_staff, keyed by
// lineage) is deleted with it. Mirrors the old useGroupCodes.deleteCode.
export async function deleteCode(id: string): Promise<void> {
  const [row] = await db
    .select({ parentId: schema.groupCodes.parentId, lineageId: schema.groupCodes.lineageId })
    .from(schema.groupCodes)
    .where(eq(schema.groupCodes.id, id))
    .limit(1)
  const newParent = row?.parentId ?? null
  const lineage = row?.lineageId ?? id
  await db.update(schema.memberGroups).set({ codeId: newParent }).where(eq(schema.memberGroups.codeId, id))
  await db.update(schema.groupCodes).set({ parentId: newParent }).where(eq(schema.groupCodes.parentId, id))
  await db.delete(schema.codeRoleDefs).where(eq(schema.codeRoleDefs.codeLineageId, lineage))
  await db.delete(schema.codeStaff).where(eq(schema.codeStaff.codeLineageId, lineage))
  await db.delete(schema.groupCodes).where(eq(schema.groupCodes.id, id))
}

// ── Term rollover clone (mig 201) ──
// Clone the chosen source groups into a target term, parent-before-child (remapping
// parent_id onto the new clones), carrying schedules / membership plans / a term-fee
// link / fee options+items (re-read from source) + the people the caller resolved,
// then roll the connected waitlists. One logical groups-domain operation — it writes
// several tables via the shared schema (member_group_schedules/plans/terms, group_fee_*,
// waitlists/waitlist_entries), which is fine since this repo is the single writer.
export interface RolloverPersonInput {
  personId: string
  roles: string[]
  role: string | null
  subGroupId: string | null
}
export interface RolloverPlanInput {
  sourceId: string
  parentSourceId: string | null
  name: string
  color: string | null
  sortOrder: number | null
  codeId: string | null
  formId: string | null
  imageUrl: string | null
  code: string | null
  ageRange: string | null
  capacity: number | null
  termFee: string | number | null
  genderRestriction: string | null
  subGroups: any[]
  lineageId: string | null
  people: RolloverPersonInput[]
}
export interface RolloverTargetTerm {
  id: string
  name: string | null
  startDate: string | null
  endDate: string | null
}
export async function rollOverGroups(
  orgId: string,
  targetTerm: RolloverTargetTerm,
  plans: RolloverPlanInput[],
): Promise<{ created: number }> {
  if (plans.length === 0) return { created: 0 }
  const includedIds = new Set(plans.map((p) => p.sourceId))
  const srcIds = [...includedIds]

  // Bulk re-read the child rows to clone from the sources.
  const schedRows = await db
    .select()
    .from(schema.memberGroupSchedules)
    .where(inArray(schema.memberGroupSchedules.groupId, srcIds))
  const schedsBy: Record<string, typeof schedRows> = {}
  for (const s of schedRows) (schedsBy[s.groupId] ??= []).push(s)

  const planLinks = await db
    .select()
    .from(schema.memberGroupPlans)
    .where(inArray(schema.memberGroupPlans.groupId, srcIds))
  const plansBy: Record<string, typeof planLinks> = {}
  for (const l of planLinks) (plansBy[l.groupId] ??= []).push(l)

  const feeOpts = await db
    .select()
    .from(schema.groupFeeOptions)
    .where(inArray(schema.groupFeeOptions.groupId, srcIds))
  const feeOptsBy: Record<string, typeof feeOpts> = {}
  for (const f of feeOpts) (feeOptsBy[f.groupId] ??= []).push(f)
  const feeItemsBy: Record<string, (typeof schema.groupFeeOptionItems.$inferSelect)[]> = {}
  if (feeOpts.length) {
    const feeItems = await db
      .select()
      .from(schema.groupFeeOptionItems)
      .where(inArray(schema.groupFeeOptionItems.optionId, feeOpts.map((f) => f.id)))
    for (const it of feeItems) (feeItemsBy[it.optionId] ??= []).push(it)
  }

  // Process parents before children so parent_id remaps onto the clone.
  const idToNew = new Map<string, string>()
  const pending = [...plans]
  let created = 0
  let guard = 0
  while (pending.length && guard++ < pending.length + plans.length + 5) {
    const p = pending.shift()!
    const parentIncluded = p.parentSourceId && includedIds.has(p.parentSourceId)
    if (parentIncluded && !idToNew.has(p.parentSourceId!)) {
      pending.push(p)
      continue
    }
    const newParentId = parentIncluded ? idToNew.get(p.parentSourceId!)! : null
    const newId = await cloneOneGroup(orgId, targetTerm, p, newParentId, schedsBy, plansBy, feeOptsBy, feeItemsBy)
    idToNew.set(p.sourceId, newId)
    created++
  }
  await rollOverWaitlistsFor(orgId, targetTerm, idToNew)
  return { created }
}

async function cloneOneGroup(
  orgId: string,
  targetTerm: RolloverTargetTerm,
  p: RolloverPlanInput,
  newParentId: string | null,
  schedsBy: Record<string, any[]>,
  plansBy: Record<string, any[]>,
  feeOptsBy: Record<string, any[]>,
  feeItemsBy: Record<string, any[]>,
): Promise<string> {
  const newId = randomUUID()
  const lineage = p.lineageId || p.sourceId
  await db.insert(schema.memberGroups).values({
    id: newId,
    orgId,
    name: p.name?.trim() || 'Class',
    color: p.color ?? null,
    parentId: newParentId,
    sortOrder: p.sortOrder ?? 0,
    codeId: p.codeId ?? null,
    formId: p.formId ?? null,
    imageUrl: p.imageUrl ?? null,
    code: p.code ?? null,
    ageRange: p.ageRange ?? null,
    capacity: p.capacity ?? null,
    genderRestriction: p.genderRestriction ?? null,
    termId: targetTerm.id,
    termFee: p.termFee ?? null,
    currentTerm: targetTerm.name ?? null,
    lineageId: lineage,
    rolledFromGroupId: p.sourceId,
    subGroups: p.subGroups ?? [],
    kind: 'class',
  } as any)

  // A source created outside the rollover path may have no lineage — stamp it with
  // its own id so source + clone share one lineage (keeps "already rolled" accurate).
  if (!p.lineageId) {
    await db.update(schema.memberGroups).set({ lineageId: p.sourceId }).where(eq(schema.memberGroups.id, p.sourceId))
  }

  for (const s of schedsBy[p.sourceId] ?? []) {
    await db.insert(schema.memberGroupSchedules).values({
      id: randomUUID(),
      orgId,
      groupId: newId,
      name: s.name ?? null,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      location: s.location ?? {},
      sortOrder: s.sortOrder ?? 0,
    } as any)
  }

  for (const l of plansBy[p.sourceId] ?? []) {
    await db.insert(schema.memberGroupPlans).values({ id: randomUUID(), groupId: newId, planId: l.planId } as any)
  }
  await db.insert(schema.memberGroupTerms).values({
    id: randomUUID(),
    groupId: newId,
    termId: targetTerm.id,
    fee: p.termFee ?? null,
  } as any)

  for (const fo of feeOptsBy[p.sourceId] ?? []) {
    const newOptId = randomUUID()
    await db.insert(schema.groupFeeOptions).values({
      id: newOptId,
      orgId,
      groupId: newId,
      name: fo.name,
      feeType: fo.feeType,
      status: fo.status ?? 'active',
      sortOrder: fo.sortOrder ?? 0,
      periodUnit: fo.periodUnit ?? null,
      periodCount: fo.periodCount ?? null,
      autoRenew: fo.autoRenew ?? null,
      instalmentCount: fo.instalmentCount ?? null,
      sessionCount: fo.sessionCount ?? null,
      prorata: fo.prorata ?? null,
      description: fo.description ?? null,
      dueDate: fo.dueDate ?? null,
      depositPercent: fo.depositPercent ?? null,
    } as any)
    for (const it of feeItemsBy[fo.id] ?? []) {
      await db.insert(schema.groupFeeOptionItems).values({
        id: randomUUID(),
        optionId: newOptId,
        name: it.name ?? null,
        amount: it.amount ?? null,
        account: it.account ?? null,
        sortOrder: it.sortOrder ?? 0,
      } as any)
    }
  }

  for (const person of p.people) {
    await db.insert(schema.memberGroupMemberships).values({
      groupId: newId,
      personId: person.personId,
      roles: person.roles ?? (person.role ? [person.role] : []),
      role: person.role ?? person.roles?.[0] ?? null,
      positions: [],
      subGroupId: person.subGroupId ?? null,
      termId: targetTerm.id,
      startDate: targetTerm.startDate ?? null,
      endDate: targetTerm.endDate ?? null,
      membershipStatus: 'active',
    } as any)
  }
  return newId
}

// Roll the source groups' waitlists into the target term (idempotent by lineage):
// clone each connected waitlist, reconnect the NEW groups, carry the people waiting.
async function rollOverWaitlistsFor(
  orgId: string,
  targetTerm: RolloverTargetTerm,
  idToNew: Map<string, string>,
): Promise<void> {
  const srcGroupIds = [...idToNew.keys()]
  if (!srcGroupIds.length) return
  const linked = await db
    .select({ id: schema.memberGroups.id, waitlistId: schema.memberGroups.waitlistId })
    .from(schema.memberGroups)
    .where(inArray(schema.memberGroups.id, srcGroupIds))
  const withWl = linked.filter((g) => g.waitlistId)
  if (!withWl.length) return
  const newGroupsByWl: Record<string, string[]> = {}
  for (const g of withWl) (newGroupsByWl[g.waitlistId!] ??= []).push(idToNew.get(g.id)!)

  const srcWlIds = Object.keys(newGroupsByWl)
  const srcWls = await db.select().from(schema.waitlists).where(inArray(schema.waitlists.id, srcWlIds))
  const existing = await db
    .select({ id: schema.waitlists.id, lineageId: schema.waitlists.lineageId })
    .from(schema.waitlists)
    .where(and(eq(schema.waitlists.orgId, orgId), eq(schema.waitlists.termId, targetTerm.id)))
  const existingByLineage: Record<string, string> = {}
  for (const w of existing) if (w.lineageId) existingByLineage[w.lineageId] = w.id

  for (const src of srcWls) {
    const lineage = src.lineageId || src.id
    let targetId = existingByLineage[lineage]
    if (!targetId) {
      targetId = randomUUID()
      await db.insert(schema.waitlists).values({
        id: targetId,
        orgId,
        name: src.name,
        orderMode: src.orderMode ?? 'custom',
        termId: targetTerm.id,
        lineageId: lineage,
        rolledFromId: src.id,
      } as any)
    }
    await db
      .update(schema.memberGroups)
      .set({ waitlistId: targetId })
      .where(inArray(schema.memberGroups.id, newGroupsByWl[src.id]))
    const entries = await db
      .select()
      .from(schema.waitlistEntries)
      .where(eq(schema.waitlistEntries.waitlistId, src.id))
    for (const e of entries) {
      // idempotent on (waitlist_id, person_id) — insert only if absent.
      const [dup] = await db
        .select({ id: schema.waitlistEntries.id })
        .from(schema.waitlistEntries)
        .where(and(eq(schema.waitlistEntries.waitlistId, targetId!), eq(schema.waitlistEntries.personId, e.personId)))
        .limit(1)
      if (dup) continue
      await db.insert(schema.waitlistEntries).values({
        id: randomUUID(),
        orgId,
        waitlistId: targetId!,
        personId: e.personId,
        status: e.status,
        priority: e.priority,
        sortOrder: e.sortOrder,
      } as any)
    }
  }
}

// ── Group views (mig 207) — saved Classes-style overviews. config is passthrough json. ──
function toView(r: typeof schema.groupViews.$inferSelect): GroupView {
  return { id: r.id, orgId: r.orgId, name: r.name, config: asJson(r.config), sortOrder: r.sortOrder }
}
export async function listViews(orgId: string): Promise<GroupView[]> {
  const rows = await db
    .select()
    .from(schema.groupViews)
    .where(eq(schema.groupViews.orgId, orgId))
    .orderBy(asc(schema.groupViews.sortOrder), asc(schema.groupViews.name))
  return rows.map(toView)
}
export async function getView(id: string): Promise<GroupView | null> {
  const [r] = await db.select().from(schema.groupViews).where(eq(schema.groupViews.id, id)).limit(1)
  return r ? toView(r) : null
}
export async function createView(input: GroupViewCreate): Promise<GroupView> {
  const id = randomUUID()
  await db.insert(schema.groupViews).values({
    id,
    orgId: input.orgId,
    name: input.name,
    config: input.config ?? {},
    sortOrder: input.sortOrder ?? 0,
  } as any)
  return (await getView(id))!
}
export async function updateView(id: string, patch: GroupViewPatch): Promise<GroupView | null> {
  const set: Record<string, any> = {}
  if (patch.name !== undefined) set.name = patch.name
  if (patch.config !== undefined) set.config = patch.config
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (Object.keys(set).length) await db.update(schema.groupViews).set(set).where(eq(schema.groupViews.id, id))
  return getView(id)
}
export async function deleteView(id: string): Promise<void> {
  await db.delete(schema.groupViews).where(eq(schema.groupViews.id, id))
}

// The membership → (person, group, location) refs for a whole org, used by the People
// directory's location lens. member_group_memberships has NO org_id, so scope by
// joining to member_groups (which does) and take the group's location from there.
export interface OrgMembershipRef {
  personId: string
  groupId: string
  locationId: string | null
  // The person's role on the group — the singular legacy anchor + the multi-role array
  // (mig 183). Consumers (retention, staff-vs-member split, dashboard) need both.
  role: string | null
  roles: string[]
}
export async function listMembershipsByOrg(orgId: string): Promise<OrgMembershipRef[]> {
  const rows = await db
    .select({
      personId: schema.memberGroupMemberships.personId,
      groupId: schema.memberGroupMemberships.groupId,
      locationId: schema.memberGroups.locationId,
      role: schema.memberGroupMemberships.role,
      roles: schema.memberGroupMemberships.roles,
    })
    .from(schema.memberGroupMemberships)
    .innerJoin(schema.memberGroups, eq(schema.memberGroupMemberships.groupId, schema.memberGroups.id))
    .where(eq(schema.memberGroups.orgId, orgId))
  return rows.map((r) => ({
    personId: r.personId,
    groupId: r.groupId,
    locationId: r.locationId ?? null,
    role: r.role ?? null,
    roles: asArray(r.roles),
  }))
}

// One person's memberships across an org, each with its group's primary location — for
// the person profile's Membership tab + syncGroups diff. member_group_memberships has
// no org_id, so scope by joining to member_groups and filter by person.
export interface PersonMembershipRef {
  groupId: string
  personId: string
  role: string | null
  roles: string[]
  locationId: string | null
}
export async function listMembershipsForPerson(
  orgId: string,
  personId: string,
): Promise<PersonMembershipRef[]> {
  const rows = await db
    .select({
      groupId: schema.memberGroupMemberships.groupId,
      personId: schema.memberGroupMemberships.personId,
      role: schema.memberGroupMemberships.role,
      roles: schema.memberGroupMemberships.roles,
      locationId: schema.memberGroups.locationId,
    })
    .from(schema.memberGroupMemberships)
    .innerJoin(schema.memberGroups, eq(schema.memberGroupMemberships.groupId, schema.memberGroups.id))
    .where(and(eq(schema.memberGroups.orgId, orgId), eq(schema.memberGroupMemberships.personId, personId)))
  return rows.map((r) => ({
    groupId: r.groupId,
    personId: r.personId,
    role: r.role ?? null,
    roles: asArray(r.roles),
    locationId: r.locationId ?? null,
  }))
}

// Add/update one person's membership on a group (the pk is group_id+person_id). Any
// field the caller omits is left untouched on update; on insert the notNull json
// columns (roles/positions) are seeded to []. json columns take RAW arrays.
export interface MembershipUpsert {
  groupId: string
  personId: string
  role?: string | null
  roles?: string[]
  positions?: string[]
  subGroupId?: string | null
  termId?: string | null
  planOptionId?: string | null
  feeOptionId?: string | null
  startDate?: string | null
  endDate?: string | null
  autoRenew?: boolean | null
  membershipStatus?: string | null
}
export async function upsertMembership(input: MembershipUpsert): Promise<MemberGroupMembership> {
  const [existing] = await db
    .select()
    .from(schema.memberGroupMemberships)
    .where(
      and(
        eq(schema.memberGroupMemberships.groupId, input.groupId),
        eq(schema.memberGroupMemberships.personId, input.personId),
      ),
    )
    .limit(1)
  const set: Record<string, any> = {}
  if (input.role !== undefined) set.role = input.role
  if (input.roles !== undefined) set.roles = input.roles
  if (input.positions !== undefined) set.positions = input.positions
  if (input.subGroupId !== undefined) set.subGroupId = input.subGroupId
  if (input.termId !== undefined) set.termId = input.termId
  if (input.planOptionId !== undefined) set.planOptionId = input.planOptionId
  if (input.feeOptionId !== undefined) set.feeOptionId = input.feeOptionId
  if (input.startDate !== undefined) set.startDate = input.startDate
  if (input.endDate !== undefined) set.endDate = input.endDate
  if (input.autoRenew !== undefined) set.autoRenew = input.autoRenew
  if (input.membershipStatus !== undefined) set.membershipStatus = input.membershipStatus
  if (existing) {
    if (Object.keys(set).length)
      await db
        .update(schema.memberGroupMemberships)
        .set(set)
        .where(
          and(
            eq(schema.memberGroupMemberships.groupId, input.groupId),
            eq(schema.memberGroupMemberships.personId, input.personId),
          ),
        )
  } else {
    await db.insert(schema.memberGroupMemberships).values({
      groupId: input.groupId,
      personId: input.personId,
      role: input.role ?? null,
      roles: input.roles ?? [],
      positions: input.positions ?? [],
      subGroupId: input.subGroupId ?? null,
      termId: input.termId ?? null,
      planOptionId: input.planOptionId ?? null,
      feeOptionId: input.feeOptionId ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      autoRenew: input.autoRenew ?? null,
      membershipStatus: input.membershipStatus ?? null,
    } as any)
  }
  const [r] = await db
    .select()
    .from(schema.memberGroupMemberships)
    .where(
      and(
        eq(schema.memberGroupMemberships.groupId, input.groupId),
        eq(schema.memberGroupMemberships.personId, input.personId),
      ),
    )
    .limit(1)
  return toMembership(r)
}

export async function deleteMembership(groupId: string, personId: string): Promise<void> {
  await db
    .delete(schema.memberGroupMemberships)
    .where(
      and(
        eq(schema.memberGroupMemberships.groupId, groupId),
        eq(schema.memberGroupMemberships.personId, personId),
      ),
    )
}

// ── Fee options (delete-then-insert per group) ──
// One fee option carries type-specific columns beyond the thin read contract
// (period/instalment/session/prorata/due/deposit); the input accepts them all as
// optional so the composable can persist whichever its fee_type uses. Each option's
// line items are inserted after it. Scoped by groupId; orgId stamped on each row.
export interface FeeOptionItemInput {
  name?: string | null
  amount?: string | number | null
  account?: string | null
  sortOrder?: number | null
}
export interface FeeOptionInput {
  name: string
  feeType: string
  status?: string
  sortOrder?: number | null
  periodUnit?: string | null
  periodCount?: number | null
  autoRenew?: boolean | null
  instalmentCount?: number | null
  sessionCount?: number | null
  prorata?: boolean | null
  description?: string | null
  dueDate?: string | null
  depositPercent?: string | number | null
  items?: FeeOptionItemInput[]
}
export async function saveFeeOptions(
  orgId: string,
  groupId: string,
  options: FeeOptionInput[],
): Promise<GroupFeeOption[]> {
  // Wipe existing options + their items for this group, then re-insert.
  const existing = await db
    .select({ id: schema.groupFeeOptions.id })
    .from(schema.groupFeeOptions)
    .where(eq(schema.groupFeeOptions.groupId, groupId))
  for (const o of existing) {
    await db.delete(schema.groupFeeOptionItems).where(eq(schema.groupFeeOptionItems.optionId, o.id))
  }
  await db.delete(schema.groupFeeOptions).where(eq(schema.groupFeeOptions.groupId, groupId))

  for (let i = 0; i < options.length; i++) {
    const o = options[i]
    const optionId = randomUUID()
    await db.insert(schema.groupFeeOptions).values({
      id: optionId,
      orgId,
      groupId,
      name: o.name,
      feeType: o.feeType,
      status: o.status ?? 'active',
      sortOrder: o.sortOrder ?? i,
      periodUnit: o.periodUnit ?? null,
      periodCount: o.periodCount ?? null,
      autoRenew: o.autoRenew ?? null,
      instalmentCount: o.instalmentCount ?? null,
      sessionCount: o.sessionCount ?? null,
      prorata: o.prorata ?? null,
      description: o.description ?? null,
      dueDate: o.dueDate ?? null,
      depositPercent: o.depositPercent ?? null,
    } as any)
    const items = o.items ?? []
    for (let j = 0; j < items.length; j++) {
      const it = items[j]
      await db.insert(schema.groupFeeOptionItems).values({
        id: randomUUID(),
        optionId,
        name: it.name ?? null,
        amount: it.amount ?? null,
        account: it.account ?? null,
        sortOrder: it.sortOrder ?? j,
      } as any)
    }
  }
  return listFeeOptions(groupId)
}

// Append one fee option to MANY groups at once (bulk add — never wipes existing).
// sortOrder per group = its current option count.
export async function addFeeOptionToGroups(
  orgId: string,
  groupIds: string[],
  option: FeeOptionInput,
): Promise<void> {
  for (const groupId of groupIds) {
    const existing = await db
      .select({ id: schema.groupFeeOptions.id })
      .from(schema.groupFeeOptions)
      .where(eq(schema.groupFeeOptions.groupId, groupId))
    const optionId = randomUUID()
    await db.insert(schema.groupFeeOptions).values({
      id: optionId,
      orgId,
      groupId,
      name: option.name,
      feeType: option.feeType,
      status: option.status ?? 'active',
      sortOrder: existing.length,
      periodUnit: option.periodUnit ?? null,
      periodCount: option.periodCount ?? null,
      autoRenew: option.autoRenew ?? null,
      instalmentCount: option.instalmentCount ?? null,
      sessionCount: option.sessionCount ?? null,
      prorata: option.prorata ?? null,
      description: option.description ?? null,
      dueDate: option.dueDate ?? null,
      depositPercent: option.depositPercent ?? null,
    } as any)
    const items = option.items ?? []
    for (let j = 0; j < items.length; j++) {
      const it = items[j]
      await db.insert(schema.groupFeeOptionItems).values({
        id: randomUUID(),
        optionId,
        name: it.name ?? null,
        amount: it.amount ?? null,
        account: it.account ?? null,
        sortOrder: it.sortOrder ?? j,
      } as any)
    }
  }
}

// ── Schedules (delete-then-insert per group) ──
// Weekly training slots. location is a RAW json LocationEntry. Scoped by groupId.
export interface ScheduleInput {
  name?: string | null
  dayOfWeek: number
  startTime: string
  endTime: string
  location?: any
  sortOrder?: number | null
}
export async function saveSchedules(
  orgId: string,
  groupId: string,
  rows: ScheduleInput[],
): Promise<MemberGroupSchedule[]> {
  await db.delete(schema.memberGroupSchedules).where(eq(schema.memberGroupSchedules.groupId, groupId))
  for (let i = 0; i < rows.length; i++) {
    const s = rows[i]
    await db.insert(schema.memberGroupSchedules).values({
      id: randomUUID(),
      orgId,
      groupId,
      name: s.name ?? null,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      location: s.location ?? {},
      sortOrder: s.sortOrder ?? i,
    } as any)
  }
  return listSchedules(groupId)
}

/** Every group whose code_id is one of the given codes (public-reg code-target
 *  expansion). Empty codeIds → []. Ordered by author order. */
export async function listGroupsByCodeIds(codeIds: string[]): Promise<MemberGroup[]> {
  if (codeIds.length === 0) return []
  const rows = await db
    .select()
    .from(schema.memberGroups)
    .where(inArray(schema.memberGroups.codeId, codeIds))
    .orderBy(asc(schema.memberGroups.sortOrder))
  return rows.map(toGroup)
}

// The memberships of a SET of groups, each hydrated with its person's display fields
// (name/email/phone/dob/gender) — for the team allocator's source/destination pools.
// member_group_memberships has no org_id; the caller passes trusted group ids.
export interface MembershipWithPerson {
  groupId: string
  personId: string
  role: string | null
  roles: string[]
  person: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
    dob: string | null
    gender: string | null
  } | null
}
export async function listMembershipsWithPersonForGroups(
  groupIds: string[],
): Promise<MembershipWithPerson[]> {
  if (groupIds.length === 0) return []
  const rows = await db
    .select({
      groupId: schema.memberGroupMemberships.groupId,
      personId: schema.memberGroupMemberships.personId,
      role: schema.memberGroupMemberships.role,
      roles: schema.memberGroupMemberships.roles,
      pid: schema.persons.id,
      firstName: schema.persons.firstName,
      lastName: schema.persons.lastName,
      email: schema.persons.email,
      phone: schema.persons.phone,
      dob: schema.persons.dob,
      gender: schema.persons.gender,
    })
    .from(schema.memberGroupMemberships)
    .innerJoin(schema.persons, eq(schema.memberGroupMemberships.personId, schema.persons.id))
    .where(inArray(schema.memberGroupMemberships.groupId, groupIds))
  return rows.map((r) => ({
    groupId: r.groupId,
    personId: r.personId,
    role: r.role ?? null,
    roles: asArray(r.roles),
    person: {
      id: r.pid,
      firstName: r.firstName ?? null,
      lastName: r.lastName ?? null,
      email: r.email ?? null,
      phone: r.phone ?? null,
      dob: r.dob ? String(r.dob).slice(0, 10) : null,
      gender: r.gender ?? null,
    },
  }))
}

// Memberships of a set of groups with the fields the retention report needs: the
// membership start_date + person name/email/phone/created_at. Distinct from
// listMembershipsWithPersonForGroups (which carries dob/gender for the allocator).
// member_group_memberships has no org_id; the caller passes trusted group ids.
export interface RetentionMembership {
  groupId: string
  personId: string
  role: string | null
  roles: string[]
  startDate: string | null
  person: {
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
    createdAt: string | null
  } | null
}
export async function listMembershipsForRetention(groupIds: string[]): Promise<RetentionMembership[]> {
  if (groupIds.length === 0) return []
  const rows = await db
    .select({
      groupId: schema.memberGroupMemberships.groupId,
      personId: schema.memberGroupMemberships.personId,
      role: schema.memberGroupMemberships.role,
      roles: schema.memberGroupMemberships.roles,
      startDate: schema.memberGroupMemberships.startDate,
      firstName: schema.persons.firstName,
      lastName: schema.persons.lastName,
      email: schema.persons.email,
      phone: schema.persons.phone,
      createdAt: schema.persons.createdAt,
    })
    .from(schema.memberGroupMemberships)
    .innerJoin(schema.persons, eq(schema.memberGroupMemberships.personId, schema.persons.id))
    .where(inArray(schema.memberGroupMemberships.groupId, groupIds))
  return rows.map((r) => ({
    groupId: r.groupId,
    personId: r.personId,
    role: r.role ?? null,
    roles: asArray(r.roles),
    startDate: r.startDate ? String(r.startDate).slice(0, 10) : null,
    person: {
      firstName: r.firstName ?? null,
      lastName: r.lastName ?? null,
      email: r.email ?? null,
      phone: r.phone ?? null,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.createdAt ?? null),
    },
  }))
}

// Memberships of a set of groups with roster fields the rollover screen needs:
// role/roles + sub_group_id + person first/last name. member_group_memberships has no
// org_id; the caller passes trusted group ids.
export interface RosterMembership {
  groupId: string
  personId: string
  role: string | null
  roles: string[]
  subGroupId: string | null
  firstName: string | null
  lastName: string | null
}
export async function listMembershipsRoster(groupIds: string[]): Promise<RosterMembership[]> {
  if (groupIds.length === 0) return []
  const rows = await db
    .select({
      groupId: schema.memberGroupMemberships.groupId,
      personId: schema.memberGroupMemberships.personId,
      role: schema.memberGroupMemberships.role,
      roles: schema.memberGroupMemberships.roles,
      subGroupId: schema.memberGroupMemberships.subGroupId,
      firstName: schema.persons.firstName,
      lastName: schema.persons.lastName,
    })
    .from(schema.memberGroupMemberships)
    .innerJoin(schema.persons, eq(schema.memberGroupMemberships.personId, schema.persons.id))
    .where(inArray(schema.memberGroupMemberships.groupId, groupIds))
  return rows.map((r) => ({
    groupId: r.groupId,
    personId: r.personId,
    role: r.role ?? null,
    roles: asArray(r.roles),
    subGroupId: r.subGroupId ?? null,
    firstName: r.firstName ?? null,
    lastName: r.lastName ?? null,
  }))
}

// Move a person between groups: insert the destination membership (SKIP if one
// already exists — never overwrite the dest row) THEN delete the source row, so a
// failure never loses the person from every group. Mirrors the legacy transfer.
export async function moveMembership(input: {
  fromGroupId: string
  toGroupId: string
  personId: string
  role?: string | null
  roles?: string[]
  termId?: string | null
}): Promise<void> {
  if (input.fromGroupId === input.toGroupId) return
  const [existing] = await db
    .select({ personId: schema.memberGroupMemberships.personId })
    .from(schema.memberGroupMemberships)
    .where(
      and(
        eq(schema.memberGroupMemberships.groupId, input.toGroupId),
        eq(schema.memberGroupMemberships.personId, input.personId),
      ),
    )
    .limit(1)
  if (!existing) {
    await db.insert(schema.memberGroupMemberships).values({
      groupId: input.toGroupId,
      personId: input.personId,
      role: input.role ?? null,
      roles: input.roles && input.roles.length ? input.roles : [],
      positions: [],
      termId: input.termId ?? null,
    } as any)
  }
  await db
    .delete(schema.memberGroupMemberships)
    .where(
      and(
        eq(schema.memberGroupMemberships.groupId, input.fromGroupId),
        eq(schema.memberGroupMemberships.personId, input.personId),
      ),
    )
}
