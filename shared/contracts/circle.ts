// The CONTRACT for the circles / notes / entities domain: Zod schemas + the domain
// types inferred from them, shared by the client (typed composable) and the server
// (Nitro route output validation). DB-neutral by design — the array/object columns
// (categories, tags, links, roles, custom_fields) are `json` in MySQL today, were
// Postgres arrays/jsonb before, and could be anything behind a future API; the UI
// and pure logic only ever see string[] / plain objects, and only the repository
// mapper knows the storage.
//
// Lives in shared/ so the Vue app and the Nitro server import the exact same
// definition — one source of truth for the shape AND its validation.
import { z } from 'zod'

// A circle: one primitive for both relationship types — a Family is a circle with
// kind='family', a Circle is kind='circle'.
export const circleSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  kind: z.string(),
  color: z.string().nullable(),
  imageUrl: z.string().nullable(),
})
export type Circle = z.infer<typeof circleSchema>

export const circleListSchema = z.array(circleSchema)

// A person's membership of a circle — carries the capability + contact flags. The
// booleans are `boolean` at the boundary (MySQL tinyint 0/1 is coerced in the mapper).
export const circleMemberSchema = z.object({
  id: z.string(),
  circleId: z.string(),
  personId: z.string(),
  role: z.string(),
  canBookFor: z.boolean(),
  canView: z.boolean(),
  canRegister: z.boolean(),
  isLead: z.boolean(),
  relationship: z.string().nullable(),
  isPrimary: z.boolean(),
  contactType: z.string().nullable(),
  receivesComms: z.boolean(),
  sortOrder: z.number().int(),
})
export type CircleMember = z.infer<typeof circleMemberSchema>

export const circleMemberListSchema = z.array(circleMemberSchema)

// Which comm categories a recipient opts into on a subject's behalf. No row = all.
export const commsPreferenceSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  personId: z.string(),
  subjectPersonId: z.string(),
  // json array → plain string[] at the boundary. Empty when not set.
  categories: z.array(z.string()),
})
export type CommsPreference = z.infer<typeof commsPreferenceSchema>

export const commsPreferenceListSchema = z.array(commsPreferenceSchema)

// A note on a person, scoped to a context via its `links`.
export const personNoteSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  personId: z.string(),
  body: z.string(),
  // json array → plain string[] at the boundary. Empty when not set.
  tags: z.array(z.string()),
  channel: z.string().nullable(),
  authorId: z.string().nullable(),
  authorName: z.string().nullable(),
  // json array of link objects ({ type, id, label }) — passthrough at the boundary.
  links: z.array(z.any()),
  // ISO 8601 — the transport form. The DB stores a timestamp; the repo serialises.
  createdAt: z.string(),
})
export type PersonNote = z.infer<typeof personNoteSchema>

export const personNoteListSchema = z.array(personNoteSchema)

// An entity record (a Team/Company/School…) — an instance of an entity-kind
// person_target_type.
export const entitySchema = z.object({
  id: z.string(),
  orgId: z.string(),
  typeKey: z.string(),
  name: z.string(),
  // json object → plain object at the boundary; z.record needs BOTH args in Zod v4.
  customFields: z.record(z.string(), z.any()),
  status: z.string(),
})
export type Entity = z.infer<typeof entitySchema>

export const entityListSchema = z.array(entitySchema)

// A person attached to an entity, with the roles they hold on it.
export const entityMemberSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  personId: z.string(),
  // json array → plain string[] at the boundary. Empty when not set.
  roles: z.array(z.string()),
})
export type EntityMember = z.infer<typeof entityMemberSchema>

export const entityMemberListSchema = z.array(entityMemberSchema)
