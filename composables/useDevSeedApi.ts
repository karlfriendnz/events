// The client side of the dev seed/reset engine. Settings → Advanced calls this —
// never useDb(), never Supabase. Typed $fetch to /api/v1/dev/*.
import type { SeedRecipeInfo, SeedSummary, ResetSummary } from '../shared/contracts/devSeed'

export function useDevSeedApi() {
  /** The recipe catalogue (options resolved server-side). */
  async function recipes(): Promise<SeedRecipeInfo[]> {
    return await $fetch<SeedRecipeInfo[]>('/api/v1/dev/recipes')
  }
  /** Run a recipe. `orgId` is required for scope:'org' recipes, ignored otherwise. */
  async function seed(recipe: string, orgId?: string | null, options?: Record<string, any>): Promise<SeedSummary> {
    return await $fetch<SeedSummary>('/api/v1/dev/seed', { method: 'POST', body: { recipe, orgId: orgId ?? null, options: options ?? {} } })
  }
  /** Clear an org's data ('org-data') or delete the org tree ('org-tree'). */
  async function reset(orgId: string, mode: 'org-data' | 'org-tree'): Promise<ResetSummary> {
    return await $fetch<ResetSummary>('/api/v1/dev/reset', { method: 'POST', body: { orgId, mode } })
  }
  return { recipes, seed, reset }
}
