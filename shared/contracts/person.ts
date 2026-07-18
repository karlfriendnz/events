// The CONTRACT for a person: a Zod schema + the domain type inferred from it,
// shared by the client (typed composable) and the server (Nitro route output
// validation). Deliberately DB-neutral — a person has `personTypes: string[]`
// whether it's stored as json, a Postgres array, or a join table; only the
// repository mapper knows the storage.
//
// Lives in shared/ so both the Vue app and the Nitro server import the exact same
// definition — one source of truth for the shape AND its validation.
import { z } from 'zod'

export const personSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  // ISO 8601 date (yyyy-mm-dd) — the transport form. The DB stores a date; the repo serialises.
  dob: z.string().nullable(),
  gender: z.string().nullable(),
  membershipType: z.string().nullable(),
  // A person may hold several types (Member, Coach…). A Postgres array / MySQL json
  // column in storage; always a plain string[] to the UI and the pure logic.
  personTypes: z.array(z.string()),
  // The legacy single-type anchor (= personTypes[0]). Kept because screens still read
  // it as a fallback when personTypes is empty, and write both on type changes.
  personType: z.string().nullable(),
  // Uploaded avatar; the UI falls back to coloured initials when null.
  photoUrl: z.string().nullable(),
  // A secondary phone (migration 178) — the profile's "Secondary phone" row reads
  // it, so the contract must carry it or a converted profile save would drop it.
  phone2: z.string().nullable(),
  // The person's own comms-topic subscriptions (migration 177) — the profile's
  // Communication field reads/writes it; a plain string[] at the boundary.
  commsTopics: z.array(z.string()),
  // Free-form answers keyed by field id — shape varies by org, so kept open.
  // (Zod v4: z.record needs an explicit key schema.)
  customFields: z.record(z.string(), z.any()),
  // When the person row was created — the dashboard's "recently added" widget sorts
  // and shows it. Server-owned (omitted from the write contracts). ISO 8601.
  createdAt: z.string().nullable(),
})
export type Person = z.infer<typeof personSchema>

export const personListSchema = z.array(personSchema)

// WRITE contracts. Create omits the server-owned id (the repo generates it);
// orgId + firstName are the minimum, everything else defaults in the repo. The
// json-backed fields (personTypes, customFields) stay plain array/object here —
// the repo serialises them. Patch is a partial — any subset of the writable fields.
export const personCreateSchema = personSchema
  // createdAt is server-owned (the DB stamps it) — omitted like id.
  .omit({ id: true, createdAt: true })
  .partial({
    lastName: true,
    email: true,
    phone: true,
    phone2: true,
    dob: true,
    gender: true,
    membershipType: true,
    personTypes: true,
    personType: true,
    photoUrl: true,
    commsTopics: true,
    customFields: true,
  })
  .extend({
    orgId: z.string().min(1),
    firstName: z.string().min(1),
  })
export type PersonCreate = z.infer<typeof personCreateSchema>

// Patch omits `orgId`: which tenant a person belongs to is not an editable field.
// Leaving it in would let `PATCH /people/:id {"orgId":"<other>"}` move a person
// between tenants — cross-tenant record theft (security audit CRIT-3). Moving a
// person between orgs, if ever needed, is a separate privileged operation.
export const personPatchSchema = personCreateSchema.omit({ orgId: true }).partial()
export type PersonPatch = z.infer<typeof personPatchSchema>
