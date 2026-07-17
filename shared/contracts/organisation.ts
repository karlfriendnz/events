// The CONTRACT for an organisation: a Zod schema + the domain type inferred from
// it, shared by the client (typed composable) and the server (Nitro route output
// validation). This is the shape the UI codes against — deliberately DB-neutral,
// so whether the store is MySQL, Postgres, or the backend team's future API, the
// UI and the pure logic never change.
//
// Lives in shared/ so both the Vue app and the Nitro server import the exact same
// definition — one source of truth for the shape AND its validation.
import { z } from 'zod'

export const ORG_LEVELS = ['CLUB', 'REGIONAL', 'ASSOCIATION', 'NATIONAL', 'RST'] as const
export const orgLevelSchema = z.enum(ORG_LEVELS)
export type OrgLevel = z.infer<typeof orgLevelSchema>

export const organisationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().nullable(),
  orgLevel: orgLevelSchema,
  parentId: z.string().nullable(),
  // ISO 8601 — the transport form. The DB stores a timestamp; the repo serialises.
  createdAt: z.string(),
})
export type Organisation = z.infer<typeof organisationSchema>

export const organisationListSchema = z.array(organisationSchema)

// WRITE contracts. Create omits server-owned fields (id, createdAt); the repo
// generates the id. Update is a partial — any subset of the writable fields.
export const organisationCreateSchema = organisationSchema.omit({ id: true, createdAt: true }).partial({ slug: true, parentId: true }).extend({
  name: z.string().min(1),
})
export type OrganisationCreate = z.infer<typeof organisationCreateSchema>

// Patch deliberately omits `parentId` (and id/createdAt are already gone): moving
// an org in the hierarchy re-parents it under a different governing body, which is
// a privileged administrative act, not a field on the general update. Exposing it
// here would let any caller graft orgs across tenants (security audit CRIT-3).
// Re-parenting must be its own permission-checked endpoint.
export const organisationPatchSchema = organisationCreateSchema.omit({ parentId: true }).partial()
export type OrganisationPatch = z.infer<typeof organisationPatchSchema>

// A node in an ancestor/descendant walk — an organisation plus its distance from
// the anchor (depth 1 = immediate parent/child). Replaces the Postgres RPCs
// org_ancestors / org_descendants, which become recursive CTEs in the repository.
export const orgTreeNodeSchema = organisationSchema.extend({ depth: z.number().int() })
export type OrgTreeNode = z.infer<typeof orgTreeNodeSchema>
export const orgTreeListSchema = z.array(orgTreeNodeSchema)
