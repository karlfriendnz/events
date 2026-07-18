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

// A minimal person projection carried on hydrated reads (circle members / entity
// roster). camelCase like every other domain object — a projection, NOT ownership of
// the people domain (the repo joins persons; the composable maps it to whatever shape
// its UI reads). Nullable throughout: a membership can outlive a thin person row.
export const linkedPersonSchema = z
  .object({
    id: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    photoUrl: z.string().nullable(),
    personType: z.string().nullable(),
  })
  .nullable()
export type LinkedPerson = z.infer<typeof linkedPersonSchema>

// A circle member with its person hydrated — the shape the circles editor + the
// act-on-behalf resolvers read (they need each member's name/contact).
export const circleMemberWithPersonSchema = circleMemberSchema.extend({
  person: linkedPersonSchema,
})
export type CircleMemberWithPerson = z.infer<typeof circleMemberWithPersonSchema>

// A circle plus its hydrated members — the org-wide read powering resolution + the
// circles/contacts UI.
export const circleWithMembersSchema = circleSchema.extend({
  members: z.array(circleMemberWithPersonSchema),
})
export type CircleWithMembers = z.infer<typeof circleWithMembersSchema>
export const circleWithMembersListSchema = z.array(circleWithMembersSchema)

// WRITE contracts for a circle. Create seeds org + name + kind; color/imageUrl default.
export const circleCreateSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
  color: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
})
export type CircleCreate = z.infer<typeof circleCreateSchema>

// Patch: presentation only (name / color / imageUrl) — a circle's org + kind are fixed.
export const circlePatchSchema = z.object({
  name: z.string().optional(),
  color: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
})
export type CirclePatch = z.infer<typeof circlePatchSchema>

// WRITE contracts for a circle member (the join edge). Create needs circle + person +
// role; the capability + contact flags default in the repo. sortOrder optional.
export const circleMemberCreateSchema = z.object({
  circleId: z.string().min(1),
  personId: z.string().min(1),
  role: z.string().min(1),
  canBookFor: z.boolean().optional(),
  canView: z.boolean().optional(),
  canRegister: z.boolean().optional(),
  isLead: z.boolean().optional(),
  relationship: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
  contactType: z.string().nullable().optional(),
  receivesComms: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})
export type CircleMemberCreate = z.infer<typeof circleMemberCreateSchema>

// Patch: any subset of the edge's mutable fields.
export const circleMemberPatchSchema = z.object({
  role: z.string().optional(),
  canBookFor: z.boolean().optional(),
  canView: z.boolean().optional(),
  canRegister: z.boolean().optional(),
  isLead: z.boolean().optional(),
  relationship: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
  contactType: z.string().nullable().optional(),
  receivesComms: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})
export type CircleMemberPatch = z.infer<typeof circleMemberPatchSchema>

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

// WRITE contract for a comms preference — the upsert keyed on (personId,
// subjectPersonId). orgId scopes the row; categories is the chosen list ([] = none).
export const commsPreferenceUpsertSchema = z.object({
  orgId: z.string().min(1),
  personId: z.string().min(1),
  subjectPersonId: z.string().min(1),
  categories: z.array(z.string()),
})
export type CommsPreferenceUpsert = z.infer<typeof commsPreferenceUpsertSchema>

// A note on a person, scoped to a context via its `links`.
//
// visibleTo / visibility / isImportant / dueDate widen the READ so the profile page's
// notes feed can move off useDb (dashboard gap D8). They are `.optional()` on PURPOSE,
// NOT `.default()`: the note WRITE lives in people.ts (createNote), whose mapper predates
// these fields. `.default()` would make them REQUIRED in the inferred output type and
// break that mapper's `: PersonNote` return (a missing-property type error in a file this
// domain doesn't own); `.optional()` lets people.ts's write-return validate untouched
// while the circles-repo READ mapper always populates them for real. Consumers read them
// defensively (`?? []` / `?.`), so an absent value never renders wrong.
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
  // Who may see the note: 'staff' | 'person:<id>' scope derived from visibleTo[0].
  visibility: z.string().optional(),
  // json array of audience targets ({ type, id }) — passthrough at the boundary.
  visibleTo: z.array(z.any()).optional(),
  isImportant: z.boolean().optional(),
  // ISO date (yyyy-mm-dd) or null — a follow-up due date.
  dueDate: z.string().nullable().optional(),
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

// WRITE contracts for an entity record. Create omits the server-owned id; orgId +
// typeKey + name are the minimum, customFields/status default in the repo.
// customFields stays a plain object here — the repo serialises the json column.
export const entityCreateSchema = entitySchema
  .omit({ id: true })
  .partial({
    customFields: true,
    status: true,
  })
  .extend({
    orgId: z.string().min(1),
    typeKey: z.string().min(1),
    name: z.string().min(1),
  })
export type EntityCreate = z.infer<typeof entityCreateSchema>

export const entityPatchSchema = entityCreateSchema.partial()
export type EntityPatch = z.infer<typeof entityPatchSchema>

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

// An entity member with its person hydrated — the shape the entity record page's
// roster reads (name + contact per attached person). Same projection as circles.
export const entityMemberWithPersonSchema = entityMemberSchema.extend({
  sortOrder: z.number().int(),
  person: linkedPersonSchema,
})
export type EntityMemberWithPerson = z.infer<typeof entityMemberWithPersonSchema>
export const entityMemberWithPersonListSchema = z.array(entityMemberWithPersonSchema)

// WRITE contracts for the entity roster. Create attaches a person with roles[]; the
// repo owns the id + orgId scoping (orgId supplied so the row is tenant-scoped).
export const entityMemberCreateSchema = z.object({
  orgId: z.string().min(1),
  entityId: z.string().min(1),
  personId: z.string().min(1),
  roles: z.array(z.string()),
  sortOrder: z.number().int().optional(),
})
export type EntityMemberCreate = z.infer<typeof entityMemberCreateSchema>

// Patch: the roster edge only ever changes its roles[].
export const entityMemberPatchSchema = z.object({
  roles: z.array(z.string()),
})
export type EntityMemberPatch = z.infer<typeof entityMemberPatchSchema>

// entity member-count map: { [entityId]: count } — the directory's attach badge.
export const entityMemberCountsSchema = z.record(z.string(), z.number())
export type EntityMemberCounts = z.infer<typeof entityMemberCountsSchema>
