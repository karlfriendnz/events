// The CONTRACT for the groups domain: Zod schemas + the domain types inferred from
// them, shared by the client (typed composable) and the server (Nitro route output
// validation). DB-neutral by design — the array/object columns (sub_groups,
// location_ids, roles, positions, role_minimums, member_positions) are `json` in
// MySQL today, were Postgres arrays/jsonb before, and could be anything behind a
// future API; the UI and pure logic only ever see `string[]` / plain objects, and
// only the repository mapper knows the storage.
//
// Lives in shared/ so the Vue app and the Nitro server import the exact same
// definition — one source of truth for the shape AND its validation.
import { z } from 'zod'

// A decimal column in MySQL comes back as a string; keep it permissive + nullable so
// neither a string, a number, nor a missing value trips the boundary.
const money = z.union([z.string(), z.number()]).nullable()

// A class the club runs (a `member_groups` row). subGroups/locationIds are json.
export const memberGroupSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  codeId: z.string().nullable(),
  termId: z.string().nullable(),
  capacity: z.number().int().nullable(),
  ageRange: z.string().nullable(),
  genderRestriction: z.string().nullable(),
  // json arrays/objects → plain shapes at the boundary. Empty when not set.
  subGroups: z.array(z.any()),
  locationIds: z.array(z.string()),
  // Singular site (mig 237) — distinct from the multi-site locationIds (mig 244).
  // A group belongs to one primary location; the People-directory location lens and
  // membership-with-group reads read this. Kept alongside locationIds, not merged.
  locationId: z.string().nullable(),
  // The one waitlist this group is connected to (mig 221), or null.
  waitlistId: z.string().nullable(),
  kind: z.string(),
  formId: z.string().nullable(),
  imageUrl: z.string().nullable(),
  sortOrder: z.number().int(),
  // Term-rollover provenance (mig 201): stable lineage across terms + the exact prior
  // group cloned. Read by the rollover/wizard screens; null on legacy/evergreen rows.
  lineageId: z.string().nullable(),
  rolledFromGroupId: z.string().nullable(),
  // A class the club ended for good (mig 231) — ISO timestamp or null.
  discontinuedAt: z.string().nullable(),
  // Per-membership settings blob (migs 241/242) — passthrough json.
  membershipSettings: z.any().nullable(),
  // Legacy free-text detail columns still rendered by the group INFO card (mig 198).
  code: z.string().nullable(),
  currentTerm: z.string().nullable(),
  termFee: money,
  headPersonId: z.string().nullable(),
  parentId: z.string().nullable(),
})
export type MemberGroup = z.infer<typeof memberGroupSchema>

export const memberGroupListSchema = z.array(memberGroupSchema)

// WRITE contracts. Create omits the server-owned id (the repo generates it); orgId +
// name are required, everything else optional (the repo/DB fill defaults). Patch is a
// partial — any subset of the writable fields.
export const memberGroupCreateSchema = memberGroupSchema.omit({ id: true }).partial().extend({
  orgId: z.string(),
  name: z.string().min(1),
})
export type MemberGroupCreate = z.infer<typeof memberGroupCreateSchema>

export const memberGroupPatchSchema = memberGroupCreateSchema.partial()
export type MemberGroupPatch = z.infer<typeof memberGroupPatchSchema>

// A hierarchical container that holds member groups and passes down inheritable
// properties (term, staff-role minimums, member positions). Codes nest via parentId.
export const groupCodeSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  parentId: z.string().nullable(),
  termId: z.string().nullable(),
  sortOrder: z.number().int(),
  // json object → { roleKey: minimum }. Empty when not set.
  roleMinimums: z.record(z.string(), z.any()),
  memberPositions: z.array(z.string()),
  // Per-position minimum people per group — { position: minimum } (mig 217).
  positionMinimums: z.record(z.string(), z.any()),
  memberTypeKey: z.string().nullable(),
  sportId: z.string().nullable(),
  // Stable identity across term rollovers (mig 205); code-role/staff configs key on it.
  lineageId: z.string().nullable(),
})
export type GroupCode = z.infer<typeof groupCodeSchema>

export const groupCodeListSchema = z.array(groupCodeSchema)

// WRITE contracts (same shape as the group ones — orgId + name required, the rest
// optional; the repo fills json defaults, incl. the notNull positionMinimums column).
export const groupCodeCreateSchema = groupCodeSchema.omit({ id: true }).partial().extend({
  orgId: z.string(),
  name: z.string().min(1),
})
export type GroupCodeCreate = z.infer<typeof groupCodeCreateSchema>

export const groupCodePatchSchema = groupCodeCreateSchema.partial()
export type GroupCodePatch = z.infer<typeof groupCodePatchSchema>

// One person's participation in a group. roles/positions are json arrays; the
// singular `role` is the legacy anchor (= roles[0]).
export const memberGroupMembershipSchema = z.object({
  groupId: z.string(),
  personId: z.string(),
  role: z.string().nullable(),
  roles: z.array(z.string()),
  positions: z.array(z.string()),
  subGroupId: z.string().nullable(),
  termId: z.string().nullable(),
})
export type MemberGroupMembership = z.infer<typeof memberGroupMembershipSchema>

export const memberGroupMembershipListSchema = z.array(memberGroupMembershipSchema)

// A weekly training slot for a group. location is a json LocationEntry.
export const memberGroupScheduleSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  groupId: z.string(),
  name: z.string().nullable(),
  dayOfWeek: z.number().int(),
  startTime: z.string(),
  endTime: z.string(),
  // json payload — a LocationEntry; passthrough at the boundary.
  location: z.any().nullable(),
  sortOrder: z.number().int(),
})
export type MemberGroupSchedule = z.infer<typeof memberGroupScheduleSchema>

export const memberGroupScheduleListSchema = z.array(memberGroupScheduleSchema)

// One line item within a fee option (each carries its own GL/Xero account). amount
// is a MySQL decimal → string.
export const groupFeeOptionItemSchema = z.object({
  id: z.string(),
  optionId: z.string(),
  name: z.string().nullable(),
  amount: money,
  account: z.string().nullable(),
  sortOrder: z.number().int().nullable(),
})
export type GroupFeeOptionItem = z.infer<typeof groupFeeOptionItemSchema>

// A way to pay to join a group — one fee option made of one or more line items.
// The type-specific columns (period/instalment/session/prorata/due/deposit) round-trip
// so the composable's priceLabel doesn't lose data on a read (mig 204 + 225).
export const groupFeeOptionSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  groupId: z.string(),
  name: z.string(),
  feeType: z.string(),
  periodUnit: z.string().nullable(),
  periodCount: z.number().int().nullable(),
  autoRenew: z.boolean().nullable(),
  instalmentCount: z.number().int().nullable(),
  sessionCount: z.number().int().nullable(),
  prorata: z.boolean().nullable(),
  description: z.string().nullable(),
  status: z.string(),
  dueDate: z.string().nullable(),
  depositPercent: money,
  sortOrder: z.number().int().nullable(),
  items: z.array(groupFeeOptionItemSchema),
})
export type GroupFeeOption = z.infer<typeof groupFeeOptionSchema>

export const groupFeeOptionListSchema = z.array(groupFeeOptionSchema)

// A saved Classes-style overview (mig 207) — a name + a config blob ({columns, codeIds}).
// config is passthrough json (the composable owns its shape).
export const groupViewSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  config: z.any(),
  sortOrder: z.number().int(),
})
export type GroupView = z.infer<typeof groupViewSchema>
export const groupViewListSchema = z.array(groupViewSchema)

export const groupViewCreateSchema = z.object({
  orgId: z.string(),
  name: z.string().min(1),
  config: z.any().optional(),
  sortOrder: z.number().int().optional(),
})
export type GroupViewCreate = z.infer<typeof groupViewCreateSchema>

export const groupViewPatchSchema = z.object({
  name: z.string().optional(),
  config: z.any().optional(),
  sortOrder: z.number().int().optional(),
})
export type GroupViewPatch = z.infer<typeof groupViewPatchSchema>
