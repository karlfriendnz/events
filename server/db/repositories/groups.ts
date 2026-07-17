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
import { asc, eq } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  MemberGroup,
  GroupCode,
  MemberGroupMembership,
  MemberGroupSchedule,
  GroupFeeOption,
  GroupFeeOptionItem,
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
