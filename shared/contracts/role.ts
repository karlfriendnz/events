// The CONTRACT for the roles & permissions domain: Zod schemas + the domain types
// inferred from them, shared by the client (typed composable) and the server (Nitro
// route output validation). DB-neutral by design — capabilities / grants are `json`
// columns in MySQL today (Postgres arrays/jsonb before); the UI and pure logic only
// ever see `string[]` / a plain object, and only the repository mapper knows the
// storage.
//
// Lives in shared/ so the Vue app and the Nitro server import the exact same
// definition — one source of truth for the shape AND its validation.
import { z } from 'zod'

// A scoped (per-resource) role a club defines once and assigns across all groups /
// all events. `resourceType`/`roleGroup` are open string sets validated at the
// boundary, not DB CHECKs; `capabilities` is a json array → string[].
export const scopedRoleDefSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  resourceType: z.string(),
  key: z.string(),
  label: z.string(),
  roleGroup: z.string(),
  capabilities: z.array(z.string()),
  fieldType: z.string().nullable(),
  sortOrder: z.number().int(),
})
export type ScopedRoleDef = z.infer<typeof scopedRoleDefSchema>

export const scopedRoleDefListSchema = z.array(scopedRoleDefSchema)

// WRITE contracts. Create omits the server-owned id; orgId/resourceType/key/label/
// roleGroup are required, capabilities + fieldType + sortOrder default in the repo.
// Patch is a partial.
export const scopedRoleDefCreateSchema = scopedRoleDefSchema
  .omit({ id: true })
  .partial({ capabilities: true, fieldType: true, sortOrder: true })
export type ScopedRoleDefCreate = z.infer<typeof scopedRoleDefCreateSchema>

export const scopedRoleDefPatchSchema = scopedRoleDefCreateSchema.partial()
export type ScopedRoleDefPatch = z.infer<typeof scopedRoleDefPatchSchema>

// An org-wide RBAC permission group (a "user type"). Core templates every club
// inherits have `orgId = null` + `isCore = true`. `grants` is the json access map
// (stored in the `permissions` column) — a free object passed through at the
// boundary. `sourceGroupId` points a club override back at the core template.
export const permissionGroupSchema = z.object({
  id: z.string(),
  orgId: z.string().nullable(),
  name: z.string(),
  isCore: z.boolean(),
  sourceGroupId: z.string().nullable(),
  grants: z.record(z.string(), z.any()),
  sortOrder: z.number().int(),
})
export type PermissionGroup = z.infer<typeof permissionGroupSchema>

export const permissionGroupListSchema = z.array(permissionGroupSchema)

// A staff-role definition scoped to a group CODE's lineage (survives rename + term
// rollover). `codeLineageId` null = an org-wide default role; `orgId` scopes the
// listing since the lineage can be null. `capabilities` is a json array → string[].
export const codeRoleDefSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  codeLineageId: z.string().nullable(),
  key: z.string(),
  label: z.string(),
  capabilities: z.array(z.string()),
  sortOrder: z.number().int().nullable(),
})
export type CodeRoleDef = z.infer<typeof codeRoleDefSchema>

export const codeRoleDefListSchema = z.array(codeRoleDefSchema)

// A person assigned to a code-lineage staff role (cascades down the code chain).
export const codeStaffSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  codeLineageId: z.string(),
  personId: z.string(),
  roleKey: z.string(),
})
export type CodeStaff = z.infer<typeof codeStaffSchema>

export const codeStaffListSchema = z.array(codeStaffSchema)
