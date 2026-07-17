// GET /api/v1/discounts?orgId= — every event discount for an org. The client only
// ever talks to routes like this, never to the database. Output is validated against
// the shared contract before it leaves, so the client's types are guaranteed.
import { listDiscounts } from '../../../db/repositories/finances'
import { discountListSchema } from '../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const discounts = await listDiscounts(orgId)
  return discountListSchema.parse(discounts)
})
