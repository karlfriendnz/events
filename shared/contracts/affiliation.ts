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

// A read variant carrying the joined org NAMES — the affiliation register screens
// (a body's queue, a club's own list) show "Club X wants to affiliate to Body Y".
// clubName = organisations(org_id).name, bodyName = organisations(nso_org_id).name.
export const orgSportWithNamesSchema = orgSportSchema.extend({
  clubName: z.string().nullable(),
  bodyName: z.string().nullable(),
})
export type OrgSportWithNames = z.infer<typeof orgSportWithNamesSchema>
export const orgSportWithNamesListSchema = z.array(orgSportWithNamesSchema)

// WRITE contracts. Create omits server-owned fields (id + the requested/decided
// timestamps the repo owns); sport is required, the rest default in the repo. Patch
// is a partial — and additionally lets the affiliation flow reset the handshake
// timestamps: picking/changing a body RE-REQUESTS (requestedAt=now, decidedAt/decidedBy
// cleared), and a body's approve/decline STAMPS the decision (decidedAt + decidedBy).
// These aren't on create (a new row's requestedAt defaults in the DB) but a patch is
// how `decide`/`request` express those transitions without a bespoke endpoint.
export const orgSportCreateSchema = orgSportSchema
  .omit({ id: true, requestedAt: true, decidedAt: true })
  .partial({ displayName: true, nsoOrgId: true, isPrimary: true, sortOrder: true, affiliationStatus: true, terminology: true })
export type OrgSportCreate = z.infer<typeof orgSportCreateSchema>

export const orgSportPatchSchema = orgSportCreateSchema.partial().extend({
  requestedAt: z.string().nullable().optional(),
  decidedAt: z.string().nullable().optional(),
  decidedBy: z.string().nullable().optional(),
})
export type OrgSportPatch = z.infer<typeof orgSportPatchSchema>

// A governing body the club can affiliate to — the picker options on the club's
// Sports editor. `defaultSportName` seeds the canonical sport when a body is chosen.
// (This is an organisations read served here because it's affiliation-editor chrome;
// the picker filters to governing levels client-side via isGoverningBody.)
export const governingBodySchema = z.object({
  id: z.string(),
  name: z.string(),
  orgLevel: z.string(),
  defaultSportName: z.string().nullable(),
})
export type GoverningBody = z.infer<typeof governingBodySchema>
export const governingBodyListSchema = z.array(governingBodySchema)

// Cross-club authority granted to a person at a governing org. `targetOrgId` null =
// the whole subtree beneath the granting org; set = a specific club override.
// `capabilities` is a json array (report / events / comms) → string[].
export const orgManagerGrantSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  personId: z.string(),
  targetOrgId: z.string().nullable(),
  capabilities: z.array(z.string()),
  // The granted person's name, joined for the assignments list. Null when the
  // person row is missing.
  personName: z.string().nullable().optional(),
})
export type OrgManagerGrant = z.infer<typeof orgManagerGrantSchema>

export const orgManagerGrantListSchema = z.array(orgManagerGrantSchema)

// WRITE: replace a person's grants at a governing org (delete-then-insert). One row
// per target: targetOrgId null = the whole subtree, set = a specific club.
export const orgManagerGrantSaveSchema = z.object({
  orgId: z.string().min(1),
  personId: z.string().min(1),
  grants: z.array(z.object({
    targetOrgId: z.string().nullable(),
    capabilities: z.array(z.string()),
  })),
})
export type OrgManagerGrantSave = z.infer<typeof orgManagerGrantSaveSchema>

export const orgManagerGrantRemoveSchema = z.object({
  orgId: z.string().min(1),
  personId: z.string().min(1),
})

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
  // The assigned person, joined for the Locations screen (avatar + name + email).
  // Null when the person row is missing.
  person: z.object({
    id: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    email: z.string().nullable(),
  }).nullable().optional(),
})
export type LocationStaff = z.infer<typeof locationStaffSchema>

export const locationStaffListSchema = z.array(locationStaffSchema)

// WRITE contracts. Create requires orgId + personId; locationId null = a club-wide
// grant, sportId null = all sports; roleKey defaults in the repo. Patch tweaks the
// role or the sport scope of an existing row.
export const locationStaffCreateSchema = z.object({
  orgId: z.string().min(1),
  personId: z.string().min(1),
  locationId: z.string().nullable().optional(),
  roleKey: z.string().optional(),
  sportId: z.string().nullable().optional(),
})
export type LocationStaffCreate = z.infer<typeof locationStaffCreateSchema>

export const locationStaffPatchSchema = z.object({
  roleKey: z.string().optional(),
  sportId: z.string().nullable().optional(),
})
export type LocationStaffPatch = z.infer<typeof locationStaffPatchSchema>
