// The CONTRACT for the disciplines domain: Zod schemas + the domain types inferred
// from them, shared by the client (typed composable) and the server (Nitro route
// output validation). DB-neutral by design — the array columns (applies_to,
// person_type_keys, a requirement's value/applies_to) are `json` in MySQL today,
// were Postgres arrays/jsonb before, and could be anything behind a future API;
// the UI and pure logic only ever see `string[]` / plain values, and only the
// repository mapper knows the storage.
//
// Lives in shared/ so the Vue app and the Nitro server import the exact same
// definition — one source of truth for the shape AND its validation.
import { z } from 'zod'

// A canonical discipline a governing body defines (e.g. Football › Male › Juniors).
export const disciplineSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  sport: z.string().nullable(),
  code: z.string().nullable(),
  parentId: z.string().nullable(),
  sortOrder: z.number().int(),
  // json arrays → plain string[] at the boundary. Empty when not set.
  appliesTo: z.array(z.string()),
  personTypeKeys: z.array(z.string()),
})
export type Discipline = z.infer<typeof disciplineSchema>

export const disciplineListSchema = z.array(disciplineSchema)

// WRITE contracts. Create omits the server-owned id (the repo generates it); name +
// orgId are required, everything else defaults in the repo. Patch is a partial —
// any subset of the writable fields.
export const disciplineCreateSchema = disciplineSchema
  .omit({ id: true })
  .partial({ sport: true, code: true, parentId: true, sortOrder: true, appliesTo: true, personTypeKeys: true })
  .extend({ name: z.string().min(1) })
export type DisciplineCreate = z.infer<typeof disciplineCreateSchema>

export const disciplinePatchSchema = disciplineCreateSchema.partial()
export type DisciplinePatch = z.infer<typeof disciplinePatchSchema>

// What a governing body DEMANDS of a person in one of its disciplines. `operator`
// is a plain string (validated as a set by the boundary, not a DB CHECK); `value`
// is a free json payload (a label, a number, or a [min,max] pair for Is Between).
export const disciplineRequirementSchema = z.object({
  id: z.string(),
  disciplineId: z.string(),
  fieldColumn: z.string().nullable(),
  fieldDefinitionId: z.string().nullable(),
  fieldKey: z.string().nullable(),
  purpose: z.string(),
  operator: z.string(),
  // json payload — anything the operator needs; passthrough at the boundary.
  value: z.any().nullable(),
  exempt: z.boolean(),
  appliesTo: z.array(z.string()),
  message: z.string().nullable(),
  sortOrder: z.number().int(),
})
export type DisciplineRequirement = z.infer<typeof disciplineRequirementSchema>

export const disciplineRequirementListSchema = z.array(disciplineRequirementSchema)

// A requirement in a WRITE payload — the whole set for a discipline is replaced at
// once (delete-then-insert), so a row omits its own id AND the disciplineId (which
// comes from the route). purpose + operator are required; the rest default.
export const disciplineRequirementCreateSchema = disciplineRequirementSchema
  .omit({ id: true, disciplineId: true })
  .partial({ fieldColumn: true, fieldDefinitionId: true, fieldKey: true, value: true, exempt: true, appliesTo: true, message: true, sortOrder: true })
export type DisciplineRequirementCreate = z.infer<typeof disciplineRequirementCreateSchema>

export const disciplineRequirementSaveSchema = z.array(disciplineRequirementCreateSchema)
