// GET /api/v1/dev/recipes — the seed recipe catalogue for the Settings → Advanced
// dev tooling. Each recipe that resolves options at request time (e.g. club-by-type
// filling its club-type select) gets them resolved here.
import { seedRecipeListSchema } from '../../../../shared/contracts/devSeed'
import { SEED_RECIPES } from '../../../db/seed/registry'
import { SeedContext } from '../../../db/seed/context'

export default defineEventHandler(async () => {
  const ctx = new SeedContext(null)
  const out = []
  for (const r of SEED_RECIPES) {
    const options = r.resolveOptions ? await r.resolveOptions(ctx) : (r.options ?? [])
    out.push({ key: r.key, label: r.label, description: r.description, scope: r.scope, options })
  }
  return seedRecipeListSchema.parse(out)
})
