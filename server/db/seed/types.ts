// The seed engine's core types. A recipe is a self-contained unit that populates
// data through the repositories (never raw Drizzle) so a recipe survives any
// backend swap the same way the app does. Adding a new recipe = one file in
// recipes/ + one line in registry.ts — nothing else.
import type { SeedOption, SeedScope, SeedSummary } from '../../../shared/contracts/devSeed'
import type { SeedContext } from './context'

export type { SeedOption, SeedScope, SeedSummary }

export interface SeedRecipe {
  key: string
  label: string
  description: string
  scope: SeedScope
  // Tweakable inputs surfaced in the UI. Empty for recipes that take none.
  options?: SeedOption[]
  // Optional: resolve options at request time (e.g. fill a select from a live
  // catalogue). When present, the recipes endpoint calls this instead of `options`.
  resolveOptions?(ctx: SeedContext): Promise<SeedOption[]>
  // Do the work. `ctx.orgId` is the target org for scope 'org'; for 'new-org' /
  // 'hierarchy' the recipe creates its own org(s) and returns their ids.
  run(ctx: SeedContext, opts: Record<string, any>): Promise<SeedSummary>
}
