// GET /api/v1/finances/outstanding?orgId= — the org-wide outstanding-money rollup
// (Σ max(0, total − paid) + count of registrations still owing). Output validated.
import { outstandingByOrg } from '../../../db/repositories/finances'
import { outstandingSummarySchema } from '../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId required' })
  }
  return outstandingSummarySchema.parse(await outstandingByOrg(orgId))
})
