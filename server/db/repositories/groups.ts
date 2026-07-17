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
import { asc, eq } from 'drizzle-orm'
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
    kind: r.kind,
    formId: r.formId ?? null,
    imageUrl: r.imageUrl ?? null,
    sortOrder: r.sortOrder,
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
    memberTypeKey: r.memberTypeKey ?? null,
    sportId: r.sportId ?? null,
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
    kind: input.kind ?? 'class',
    formId: input.formId ?? null,
    imageUrl: input.imageUrl ?? null,
    sortOrder: input.sortOrder ?? 0,
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
  if (patch.kind !== undefined) set.kind = patch.kind
  if (patch.formId !== undefined) set.formId = patch.formId
  if (patch.imageUrl !== undefined) set.imageUrl = patch.imageUrl
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
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
    // notNull json column that isn't in the contract — always seed it.
    positionMinimums: {},
    memberTypeKey: input.memberTypeKey ?? null,
    sportId: input.sportId ?? null,
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
  if (patch.memberTypeKey !== undefined) set.memberTypeKey = patch.memberTypeKey
  if (patch.sportId !== undefined) set.sportId = patch.sportId
  if (Object.keys(set).length) await db.update(schema.groupCodes).set(set).where(eq(schema.groupCodes.id, id))
  return loadCode(id)
}

export async function deleteCode(id: string): Promise<void> {
  await db.delete(schema.groupCodes).where(eq(schema.groupCodes.id, id))
}
