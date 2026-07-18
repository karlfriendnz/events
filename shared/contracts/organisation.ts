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

// ── Focused fills for small consumers (branding theme, member-pull, positions,
// onboarding, privileged re-parenting) — kept off the base Organisation shape. ──

// The resolved brand theme for an org: the CONNECTED platform brand's colour (via
// brand_id → brands.color; null when no brand connected) + the level, so the theme
// composable can fall back to the governing-body blue. One call, no admin round-trip.
export const orgBrandThemeSchema = z.object({
  brandColor: z.string().nullable(),
  // The connected platform brand's NAME (via brand_id → brands.name), for
  // white-labelled labels like "{Brand} Invoices". Null when no brand is set.
  brandName: z.string().nullable(),
  orgLevel: z.string(),
})
export type OrgBrandTheme = z.infer<typeof orgBrandThemeSchema>

// The privileged re-parent body (its own endpoint — see the patch note above).
export const orgSetParentSchema = z.object({ parentId: z.string().nullable() })

// member_pull_mode: null/'reference' (point at the club's row) | 'copy' (mirror).
export const orgMemberPullModeSchema = z.object({
  memberPullMode: z.enum(['reference', 'copy']).nullable(),
})

// Org-wide default member positions (Captain/Wing/…) — a plain label list.
export const defaultMemberPositionsSchema = z.array(z.string())
export const setDefaultMemberPositionsSchema = z.object({ positions: defaultMemberPositionsSchema })

// The new-club onboarding checklist state (organisations.onboarding jsonb).
export const onboardingStateSchema = z.object({
  dismissed: z.boolean().optional(),
  completed_at: z.string().nullable().optional(),
})
export type OnboardingState = z.infer<typeof onboardingStateSchema>
