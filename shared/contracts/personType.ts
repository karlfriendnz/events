// The CONTRACT for the person-types & fields domain: Zod schemas + the domain
// types inferred from them, shared by the client (typed composable) and the server
// (Nitro route output validation). Deliberately DB-neutral — json columns surface
// as plain objects/arrays and arrays as string[], so whether the store is MySQL,
// Postgres, or the backend team's future API, the UI and pure logic never change.
//
// Lives in shared/ so both the Vue app and the Nitro server import the exact same
// definition — one source of truth for the shape AND its validation.
import { z } from 'zod'

// A person/entity TYPE a form can register (Member/Player, Parent, Team, School…).
// `permissions` is an access grid (object), `memberSlots` an entity roster def
// (array) — both json in storage, DB-neutral here. `kind` / grid values are
// varchar in MySQL, validated as strings so the set changes without a migration.
export const personTypeSchema = z.object({
  id: z.string(),
  orgId: z.string().nullable(),
  key: z.string(),
  label: z.string(),
  kind: z.string(),
  isAccess: z.boolean(),
  isPublished: z.boolean(),
  // json → object
  permissions: z.record(z.string(), z.any()),
  // json → array
  memberSlots: z.array(z.any()),
  sortOrder: z.number().int(),
})
export type PersonType = z.infer<typeof personTypeSchema>
export const personTypeListSchema = z.array(personTypeSchema)

// A custom field a person type can carry. `targets` (json → string[]) is the
// multi-type list a field applies to; `target` is the legacy single-type anchor.
// `options` (json → array) holds dropdown values (null when not a select).
export const fieldDefinitionSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  label: z.string(),
  fieldType: z.string(),
  // json → array (null on non-select fields)
  options: z.array(z.any()).nullable(),
  isRequired: z.boolean(),
  target: z.string(),
  // json → string[]
  targets: z.array(z.string()),
  sortOrder: z.number().int(),
})
export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>
export const fieldDefinitionListSchema = z.array(fieldDefinitionSchema)

// A person type inheriting from another (a club type sourced from an NSO type).
export const personTypeLinkSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  typeId: z.string(),
  sourceTypeId: z.string(),
})
export type PersonTypeLink = z.infer<typeof personTypeLinkSchema>
export const personTypeLinkListSchema = z.array(personTypeLinkSchema)
