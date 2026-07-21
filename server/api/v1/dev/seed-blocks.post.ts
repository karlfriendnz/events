// POST /api/v1/dev/seed-blocks — run a chosen set of modular seed blocks into one
// org. DEV-GATED like the other dev tools. The real auth gate (super-admin) is the
// backend team's later; today NODE_ENV + ALLOW_DEV_SEED is the guard.
import { seedBlocksRequestSchema, seedSummarySchema } from '../../../../shared/contracts/devSeed'
import { SeedContext } from '../../../db/seed/context'
import { runBlocks } from '../../../db/seed/blocks'

export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_SEED !== '1') {
    throw createError({ statusCode: 403, statusMessage: 'dev seeding disabled in production' })
  }
  const { orgId, blocks, flavour } = seedBlocksRequestSchema.parse(await readBody(event))
  const ctx = new SeedContext(orgId, flavour)
  const summary = await runBlocks(ctx, blocks)
  return seedSummarySchema.parse(summary)
})
