// The client side of the dev seed/reset engine. Settings → Advanced calls this —
// never useDb(), never Supabase. Typed $fetch to /api/v1/dev/*.
import type { SeedRecipeInfo, SeedBlockInfo, SeedSummary, ResetSummary } from '../shared/contracts/devSeed'

export function useDevSeedApi() {
  /** The recipe catalogue (options resolved server-side). */
  async function recipes(): Promise<SeedRecipeInfo[]> {
    return await $fetch<SeedRecipeInfo[]>('/api/v1/dev/recipes')
  }
  /** The modular seed blocks that apply to one org (filtered by its kind). */
  async function blocks(orgId: string): Promise<SeedBlockInfo[]> {
    return await $fetch<SeedBlockInfo[]>('/api/v1/dev/blocks', { query: { orgId } })
  }
  /** Run a chosen set of blocks into one org, themed by a club-style flavour. */
  async function seedBlocks(orgId: string, chosen: { key: string; options?: Record<string, any> }[], flavour?: string): Promise<SeedSummary> {
    return await $fetch<SeedSummary>('/api/v1/dev/seed-blocks', { method: 'POST', body: { orgId, blocks: chosen, flavour } })
  }
  /** Run a recipe. `orgId` is required for scope:'org' recipes, ignored otherwise. */
  async function seed(recipe: string, orgId?: string | null, options?: Record<string, any>): Promise<SeedSummary> {
    return await $fetch<SeedSummary>('/api/v1/dev/seed', { method: 'POST', body: { recipe, orgId: orgId ?? null, options: options ?? {} } })
  }
  /** Reset an org: 'org-data' (ops only) | 'org-content' (all data, keep config) | 'org-tree' (delete). */
  async function reset(orgId: string, mode: 'org-data' | 'org-content' | 'org-tree'): Promise<ResetSummary> {
    return await $fetch<ResetSummary>('/api/v1/dev/reset', { method: 'POST', body: { orgId, mode } })
  }
  return { recipes, blocks, seedBlocks, seed, reset }
}
