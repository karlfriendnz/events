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
  // Free-form answers keyed by field id — shape varies by org, so kept open.
  // (Zod v4: z.record needs an explicit key schema.)
  customFields: z.record(z.string(), z.any()),
})
export type Person = z.infer<typeof personSchema>

export const personListSchema = z.array(personSchema)

// WRITE contracts. Create omits the server-owned id (the repo generates it);
// orgId + firstName are the minimum, everything else defaults in the repo. The
// json-backed fields (personTypes, customFields) stay plain array/object here —
// the repo serialises them. Patch is a partial — any subset of the writable fields.
export const personCreateSchema = personSchema
  .omit({ id: true })
  .partial({
    lastName: true,
    email: true,
    phone: true,
    dob: true,
    gender: true,
    membershipType: true,
    personTypes: true,
    customFields: true,
  })
  .extend({
    orgId: z.string().min(1),
    firstName: z.string().min(1),
  })
export type PersonCreate = z.infer<typeof personCreateSchema>

export const personPatchSchema = personCreateSchema.partial()
export type PersonPatch = z.infer<typeof personPatchSchema>
