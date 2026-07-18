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

// WRITE contracts for a person type. Create omits the server-owned id; key + label
// are the minimum (the type's identity + name), everything else defaults in the
// repo. orgId is nullable (a global type has none). The json-backed fields
// (permissions, memberSlots) stay plain object/array here — the repo serialises them.
export const personTypeCreateSchema = personTypeSchema
  .omit({ id: true })
  .partial({
    orgId: true,
    kind: true,
    isAccess: true,
    isPublished: true,
    permissions: true,
    memberSlots: true,
    sortOrder: true,
  })
  .extend({
    key: z.string().min(1),
    label: z.string().min(1),
  })
export type PersonTypeCreate = z.infer<typeof personTypeCreateSchema>

export const personTypePatchSchema = personTypeCreateSchema.partial()
export type PersonTypePatch = z.infer<typeof personTypePatchSchema>

// A custom field a person type can carry. `targets` (json → string[]) is the
// multi-type list a field applies to; `target` is the legacy single-type anchor.
// `options` (json → array) holds dropdown values (null when not a select).
// `key` / `helpText` are optional column data; `meta` (builder extras: col_span,
// placeholder, block payload) + `rules` (dormant visibility rules) are json — the
// form builder (<PersonFormBuilder>) reads AND writes all four, so they're first
// class here, not just on the resolved view.
export const fieldDefinitionSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  label: z.string(),
  key: z.string().nullable(),
  fieldType: z.string(),
  // json → array (null on non-select fields)
  options: z.array(z.any()).nullable(),
  isRequired: z.boolean(),
  helpText: z.string().nullable(),
  target: z.string(),
  // json → string[]
  targets: z.array(z.string()),
  // json → object (builder extras)
  meta: z.record(z.string(), z.any()),
  // json → array (dormant field-level rules)
  rules: z.array(z.any()),
  sortOrder: z.number().int(),
})
export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>
export const fieldDefinitionListSchema = z.array(fieldDefinitionSchema)

// WRITE contracts for a custom field. Create omits the server-owned id; orgId +
// label + fieldType are the minimum, everything else defaults in the repo. `options`
// stays a plain array (or null); `targets` a plain string[]; `meta`/`rules` plain
// object/array — the repo serialises the json columns. Patch is a partial.
export const fieldDefinitionCreateSchema = fieldDefinitionSchema
  .omit({ id: true })
  .partial({
    key: true,
    options: true,
    isRequired: true,
    helpText: true,
    target: true,
    targets: true,
    meta: true,
    rules: true,
    sortOrder: true,
  })
  .extend({
    orgId: z.string().min(1),
    label: z.string().min(1),
    fieldType: z.string().min(1),
  })
export type FieldDefinitionCreate = z.infer<typeof fieldDefinitionCreateSchema>

export const fieldDefinitionPatchSchema = fieldDefinitionCreateSchema.partial()
export type FieldDefinitionPatch = z.infer<typeof fieldDefinitionPatchSchema>

// A person type inheriting from another (a club type sourced from an NSO type).
export const personTypeLinkSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  typeId: z.string(),
  sourceTypeId: z.string(),
})
export type PersonTypeLink = z.infer<typeof personTypeLinkSchema>
export const personTypeLinkListSchema = z.array(personTypeLinkSchema)

// ── Resolved views (own + inherited) ─────────────────────────────────────────
// The field ENGINE's shape: a field definition PLUS where it came from (own vs a
// governing body's, with that body's name/level). resolveFields returns these for
// an org + its governing chain, so the UI can lock inherited fields + name the
// owner. Superset of fieldDefinitionSchema with the provenance fields.
export const resolvedFieldSchema = fieldDefinitionSchema.extend({
  inherited: z.boolean(),
  ownerName: z.string(),
  ownerLevel: z.string(),
})
export type ResolvedField = z.infer<typeof resolvedFieldSchema>
export const resolvedFieldListSchema = z.array(resolvedFieldSchema)

// Own + inherited person types (Member / Guardian / Coach …) with min/max, tagged
// with provenance. resolvePersonTypes' output.
export const resolvedPersonTypeSchema = z.object({
  id: z.string(),
  orgId: z.string().nullable(),
  key: z.string(),
  label: z.string(),
  kind: z.string(),
  minCount: z.number().int().nullable(),
  maxCount: z.number().int().nullable(),
  sortOrder: z.number().int(),
  isAccess: z.boolean(),
  inherited: z.boolean(),
  ownerName: z.string(),
})
export type ResolvedPersonType = z.infer<typeof resolvedPersonTypeSchema>
export const resolvedPersonTypeListSchema = z.array(resolvedPersonTypeSchema)

// A club's OWN person/entity types with the FULL setup config (landing page, menu,
// dashboard, permissions, member slots). loadOrgTypes' output — the /proto/* and
// live setup screens drive off this.
export const orgTypeFullSchema = z.object({
  id: z.string(),
  orgId: z.string().nullable(),
  key: z.string(),
  label: z.string(),
  kind: z.string(),
  isAccess: z.boolean(),
  isPublished: z.boolean(),
  permissions: z.record(z.string(), z.any()),
  memberSlots: z.array(z.any()),
  sortOrder: z.number().int(),
  landingPath: z.string().nullable(),
  profileDashboard: z.any().nullable(),
  menuItems: z.any().nullable(),
})
export type OrgTypeFull = z.infer<typeof orgTypeFullSchema>
export const orgTypeFullListSchema = z.array(orgTypeFullSchema)

// A type a club can LINK its own type to — a governing body's PUBLISHED type,
// tagged with the owner's name. loadLinkableTypes' output.
export const linkableTypeSchema = z.object({
  id: z.string(),
  orgId: z.string().nullable(),
  key: z.string(),
  label: z.string(),
  kind: z.string(),
  ownerName: z.string(),
})
export type LinkableType = z.infer<typeof linkableTypeSchema>
export const linkableTypeListSchema = z.array(linkableTypeSchema)

// A person-type link HYDRATED with the source type's key/label/org — the payload
// resolution actually needs (a field targets a KEY). loadTypeLinks' output.
export const hydratedTypeLinkSchema = z.object({
  id: z.string(),
  typeId: z.string(),
  sourceTypeId: z.string(),
  sourceKey: z.string(),
  sourceLabel: z.string(),
  sourceOrgId: z.string(),
  sourceOrgName: z.string(),
})
export type HydratedTypeLink = z.infer<typeof hydratedTypeLinkSchema>
export const hydratedTypeLinkListSchema = z.array(hydratedTypeLinkSchema)

// The label + member-slot roster def of the type matching a key (own preferred over
// an inherited one). resolveTypeByKey's output — the entity record page uses it for
// the roster's role options.
export const typeByKeySchema = z
  .object({ label: z.string(), memberSlots: z.array(z.any()), orgId: z.string().nullable() })
  .nullable()
export type TypeByKey = z.infer<typeof typeByKeySchema>

// ── Profile form layout ──────────────────────────────────────────────────────
// The FORM LAYOUT for one person type (order, sections, blocks, per-field
// visibility) built in <PersonFormBuilder>, stored on profile_forms(org_id,
// type_key). `config` is an open json blob (the builder owns its shape).
export const profileFormSchema = z
  .object({ orgId: z.string(), typeKey: z.string(), config: z.record(z.string(), z.any()) })
  .nullable()
export type ProfileForm = z.infer<typeof profileFormSchema>
export const profileFormSaveSchema = z.object({
  orgId: z.string().min(1),
  typeKey: z.string().min(1),
  config: z.record(z.string(), z.any()),
})
export type ProfileFormSave = z.infer<typeof profileFormSaveSchema>

// ── Org-level field settings (columns on organisations / org_sports) ──────────
// Global CORE fields config: which optional cores are on, which configurable cores
// are required. Kept DB-neutral — a plain { required, enabled } object.
export const coreFieldsSchema = z.object({
  required: z.record(z.string(), z.boolean()),
  enabled: z.record(z.string(), z.boolean()),
})
export type CoreFieldsConfig = z.infer<typeof coreFieldsSchema>
export const coreFieldsSaveSchema = z.object({
  orgId: z.string().min(1),
  config: coreFieldsSchema,
})

// Terminology overrides — { termKey: { singular?, plural? } }. Non-default values
// only. Used at org level (organisations.terminology) and per sport
// (org_sports.terminology).
export const terminologyMapSchema = z.record(
  z.string(),
  z.object({ singular: z.string().optional(), plural: z.string().optional() }),
)
export type TerminologyMap = z.infer<typeof terminologyMapSchema>
// A row of org terminology: which org, its overrides.
export const orgTerminologyRowSchema = z.object({ orgId: z.string(), terminology: terminologyMapSchema })
export const orgTerminologyListSchema = z.array(orgTerminologyRowSchema)
