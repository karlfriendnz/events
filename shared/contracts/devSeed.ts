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

// ── Seed blocks (modular, org-scoped) ────────────────────────────
// A block is one small unit of demo data ("people", "events", "venues"…). The
// org-detail Seed tab lists the blocks that apply to an org's kind and runs the
// ticked ones into it. Shape mirrors a recipe minus scope (blocks are always
// org-scoped) — key/label/description + its own tweakable options.
export const seedBlockSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  options: z.array(seedOptionSchema),
})
export type SeedBlockInfo = z.infer<typeof seedBlockSchema>
export const seedBlockListSchema = z.array(seedBlockSchema)

// The "club style" that themes the seeded names (programmes/classes/venues/events/
// sport). The full themed data lives server-side (server/db/seed/flavours.ts); this
// is just the picker list for the UI. Keys must match FLAVOURS there.
export const SEED_FLAVOURS = [
  { key: 'gymnastics', label: 'Gymnastics club', description: 'Development / Recreational / Competitive programmes, gym areas, step competitions.' },
  { key: 'football', label: 'Football club', description: 'Junior / Youth / Senior teams by age grade, pitches, tournaments.' },
  { key: 'racquets', label: 'Multisport racquets club', description: 'Tennis / Badminton / Squash / Pickleball programmes, courts, interclub.' },
] as const
export type SeedFlavourKey = typeof SEED_FLAVOURS[number]['key']

// POST /api/v1/dev/seed-blocks body — run a chosen set of blocks into one org.
export const seedBlocksRequestSchema = z.object({
  orgId: z.string().min(1),
  blocks: z.array(z.object({
    key: z.string().min(1),
    options: z.record(z.string(), z.any()).optional(),
  })).min(1),
  // Which club style themes the names. Unknown/absent = the default (gymnastics).
  flavour: z.string().optional(),
})
export type SeedBlocksRequest = z.infer<typeof seedBlocksRequestSchema>

// POST /api/v1/dev/reset body.
export const resetRequestSchema = z.object({
  orgId: z.string().min(1),
  // 'org-data'    clears the org's operational data (keeps people + member groups);
  // 'org-content' clears ALL data (people/classes/codes/terms/events/venues…) but
  //               keeps the org row + its setup config (types/fields/terminology…);
  // 'org-tree'    deletes the org itself and everything cascading from it.
  mode: z.enum(['org-data', 'org-content', 'org-tree']),
})
export type ResetRequest = z.infer<typeof resetRequestSchema>

export const resetSummarySchema = z.object({
  ok: z.boolean(),
  mode: z.enum(['org-data', 'org-content', 'org-tree']),
})
export type ResetSummary = z.infer<typeof resetSummarySchema>
