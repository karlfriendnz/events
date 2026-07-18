// The one entry point the seed endpoint calls. Looks a recipe up, builds a context,
// runs it, and returns the summary. Throws a clear error for an unknown recipe or a
// scope:'org' recipe invoked without an orgId.
import type { SeedSummary } from '../../../shared/contracts/devSeed'
import { SeedContext } from './context'
import { getRecipe } from './registry'

export async function runRecipe(
  key: string,
  orgId: string | null,
  options: Record<string, any> = {},
): Promise<SeedSummary> {
  const recipe = getRecipe(key)
  if (!recipe) throw new Error(`Unknown seed recipe: ${key}`)
  if (recipe.scope === 'org' && !orgId) {
    throw new Error(`Recipe "${key}" needs an orgId (scope 'org')`)
  }

  const ctx = new SeedContext(orgId)
  return await recipe.run(ctx, options ?? {})
}
