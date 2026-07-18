// POST /api/v1/dev/seed — run a seed recipe. DEV-GATED: refused in production unless
// ALLOW_DEV_SEED=1 (the real gate — super-admin auth — is the backend team's later).
import { seedRequestSchema, seedSummarySchema } from '../../../../shared/contracts/devSeed'
import { runRecipe } from '../../../db/seed/run'

export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_SEED !== '1') {
    throw createError({ statusCode: 403, statusMessage: 'dev seeding disabled in production' })
  }
  const { recipe, orgId, options } = seedRequestSchema.parse(await readBody(event))
  const summary = await runRecipe(recipe, orgId ?? null, options ?? {})
  return seedSummarySchema.parse(summary)
})
