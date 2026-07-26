// The CONTRACT for a governing body's private overlay of edits on a club-owned
// person. The NSO edits a person it doesn't own; those edits live here (keyed by the
// NSO's org + the person) instead of on the club's persons row, until the NSO chooses
// to PUSH them to the club. Shared by the typed composable and the Nitro route.
import { z } from 'zod'

// The overridable core columns (a subset of Person). Kept as an open record at the
// boundary — only the keys the NSO actually changed are present.
export const personOverrideCoreSchema = z.object({
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  phone2: z.string().nullable().optional(),
  dob: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  membershipType: z.string().nullable().optional(),
})
export type PersonOverrideCore = z.infer<typeof personOverrideCoreSchema>

export const personOverrideSchema = z.object({
  orgId: z.string(),
  personId: z.string(),
  core: personOverrideCoreSchema,
  // NSO field values keyed by field_definition id.
  customFields: z.record(z.string(), z.any()),
  updatedAt: z.string().nullable(),
})
export type PersonOverride = z.infer<typeof personOverrideSchema>

// The overlay is nullable — a person with no NSO edits yet has no row.
export const personOverrideNullableSchema = personOverrideSchema.nullable()

// WRITE contract. orgId identifies the NSO; core/customFields are each an optional
// partial patch merged onto whatever overlay already exists.
export const personOverridePatchSchema = z.object({
  orgId: z.string().min(1),
  core: personOverrideCoreSchema.optional(),
  customFields: z.record(z.string(), z.any()).optional(),
})
export type PersonOverridePatch = z.infer<typeof personOverridePatchSchema>

// The push action just needs to know which NSO is pushing.
export const personOverridePushSchema = z.object({ orgId: z.string().min(1) })
