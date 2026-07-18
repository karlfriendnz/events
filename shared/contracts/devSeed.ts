// Contract for the dev seed/reset engine. The engine lives entirely server-side
// (server/db/seed/**) and is driven from Settings → Advanced via useDevSeedApi().
// These schemas are the wire shape between the two.
import { z } from 'zod'

// A single tweakable input a recipe exposes (e.g. "how many regions").
export const seedOptionSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['number', 'text', 'boolean', 'select']),
  // Default value — number | string | boolean depending on `type`.
  default: z.any(),
  // Only for type 'select': the allowed choices.
  choices: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
})
export type SeedOption = z.infer<typeof seedOptionSchema>

// scope tells the caller WHERE a recipe runs:
//   'org'       — populates an EXISTING org (needs an orgId).
//   'new-org'   — creates ONE new org and seeds into it.
//   'hierarchy' — creates a whole tree of orgs.
export const seedScopeSchema = z.enum(['org', 'new-org', 'hierarchy'])
export type SeedScope = z.infer<typeof seedScopeSchema>

// The recipe as advertised to the UI (its run() is server-only, not on the wire).
export const seedRecipeSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  scope: seedScopeSchema,
  options: z.array(seedOptionSchema),
})
export type SeedRecipeInfo = z.infer<typeof seedRecipeSchema>

export const seedRecipeListSchema = z.array(seedRecipeSchema)

// POST /api/v1/dev/seed body.
export const seedRequestSchema = z.object({
  recipe: z.string().min(1),
  // Required for scope 'org'; ignored for 'new-org'/'hierarchy'.
  orgId: z.string().nullable().optional(),
  // Free-form option map, validated per-recipe against its declared options.
  options: z.record(z.string(), z.any()).optional(),
})
export type SeedRequest = z.infer<typeof seedRequestSchema>

// What a run reports back — a count per entity kind + any orgs it created.
export const seedSummarySchema = z.object({
  created: z.record(z.string(), z.number()),
  orgIds: z.array(z.string()).optional(),
  note: z.string().optional(),
})
export type SeedSummary = z.infer<typeof seedSummarySchema>

// POST /api/v1/dev/reset body.
export const resetRequestSchema = z.object({
  orgId: z.string().min(1),
  // 'org-data' clears the org's operational data (keeps people + member groups);
  // 'org-tree' deletes the org itself and everything cascading from it.
  mode: z.enum(['org-data', 'org-tree']),
})
export type ResetRequest = z.infer<typeof resetRequestSchema>

export const resetSummarySchema = z.object({
  ok: z.boolean(),
  mode: z.enum(['org-data', 'org-tree']),
})
export type ResetSummary = z.infer<typeof resetSummarySchema>
