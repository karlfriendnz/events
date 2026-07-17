// The CONTRACT for the affiliations domain: club sports + their governing-body
// affiliation, cross-club manager grants, and a club's operational locations +
// per-site staff. Zod schemas + the domain types inferred from them, shared by the
// client (typed composable) and the server (Nitro route output validation).
//
// DB-neutral by design: capabilities is a `json` array in MySQL today (a Postgres
// text[] before) and the UI only ever sees `string[]`; terminology is a free `json`
// object; the affiliation-status / role-key sets are open strings validated here at
// the boundary, not by a DB CHECK — only the repository mapper knows the storage.
//
// Lives in shared/ so the Vue app and the Nitro server import the exact same
// definition — one source of truth for the shape AND its validation.
import { z } from 'zod'

// A sport a club runs, connected to one governing body (NSO). The primary sport is
// the terminology/branding source. `affiliationStatus` is an open string set
// (requested / approved / …) validated at the boundary; the timestamps are ISO 8601
// — the transport form the repo serialises from the DB's timestamps.
export const orgSportSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  sport: z.string(),
  displayName: z.string().nullable(),
  nsoOrgId: z.string().nullable(),
  isPrimary: z.boolean(),
  sortOrder: z.number().int(),
  affiliationStatus: z.string(),
  requestedAt: z.string().nullable(),
  decidedAt: z.string().nullable(),
  // free json object → plain object at the boundary; null when not set.
  terminology: z.record(z.string(), z.any()).nullable(),
})
export type OrgSport = z.infer<typeof orgSportSchema>

export const orgSportListSchema = z.array(orgSportSchema)

// WRITE contracts. Create omits server-owned fields (id + the requested/decided
// timestamps the repo owns); sport is required, the rest default in the repo. Patch
// is a partial.
export const orgSportCreateSchema = orgSportSchema
  .omit({ id: true, requestedAt: true, decidedAt: true })
  .partial({ displayName: true, nsoOrgId: true, isPrimary: true, sortOrder: true, affiliationStatus: true, terminology: true })
export type OrgSportCreate = z.infer<typeof orgSportCreateSchema>

export const orgSportPatchSchema = orgSportCreateSchema.partial()
export type OrgSportPatch = z.infer<typeof orgSportPatchSchema>

// Cross-club authority granted to a person at a governing org. `targetOrgId` null =
// the whole subtree beneath the granting org; set = a specific club override.
// `capabilities` is a json array (report / events / comms) → string[].
export const orgManagerGrantSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  personId: z.string(),
  targetOrgId: z.string().nullable(),
  capabilities: z.array(z.string()),
})
export type OrgManagerGrant = z.infer<typeof orgManagerGrantSchema>

export const orgManagerGrantListSchema = z.array(orgManagerGrantSchema)

// An operational SITE a club runs (HBC, Albany, …) — deliberately NOT a booking
// venue. Classes attach to one; staff hold roles at one or more.
export const locationSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  color: z.string().nullable(),
  sortOrder: z.number().int(),
})
export type Location = z.infer<typeof locationSchema>

export const locationListSchema = z.array(locationSchema)

// WRITE contracts. Create omits the server-owned id; name + orgId are required, the
// rest default in the repo. Patch is a partial.
export const locationCreateSchema = locationSchema
  .omit({ id: true })
  .partial({ address: true, color: true, sortOrder: true })
  .extend({ name: z.string().min(1) })
export type LocationCreate = z.infer<typeof locationCreateSchema>

export const locationPatchSchema = locationCreateSchema.partial()
export type LocationPatch = z.infer<typeof locationPatchSchema>

// A staff member's role at a location (and optionally a sport). `locationId` null =
// a club-wide grant; `roleKey` is an open string validated at the boundary.
export const locationStaffSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  locationId: z.string().nullable(),
  personId: z.string(),
  roleKey: z.string(),
  sportId: z.string().nullable(),
})
export type LocationStaff = z.infer<typeof locationStaffSchema>

export const locationStaffListSchema = z.array(locationStaffSchema)
