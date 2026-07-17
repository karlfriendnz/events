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
  kind: z.string(),
  formId: z.string().nullable(),
  imageUrl: z.string().nullable(),
  sortOrder: z.number().int(),
})
export type MemberGroup = z.infer<typeof memberGroupSchema>

export const memberGroupListSchema = z.array(memberGroupSchema)

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
  memberTypeKey: z.string().nullable(),
  sportId: z.string().nullable(),
})
export type GroupCode = z.infer<typeof groupCodeSchema>

export const groupCodeListSchema = z.array(groupCodeSchema)

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
export const groupFeeOptionSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  groupId: z.string(),
  name: z.string(),
  feeType: z.string(),
  sortOrder: z.number().int().nullable(),
  items: z.array(groupFeeOptionItemSchema),
})
export type GroupFeeOption = z.infer<typeof groupFeeOptionSchema>

export const groupFeeOptionListSchema = z.array(groupFeeOptionSchema)
