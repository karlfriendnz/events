// GET /api/v1/booking-discounts?orgId= — every booking discount for an org. The
// client only ever talks to routes like this, never to the database. Output is
// validated against the shared contract before it leaves, so the client's types are
// guaranteed.
import { listBookingDiscounts } from '../../../db/repositories/finances'
import { bookingDiscountListSchema } from '../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const discounts = await listBookingDiscounts(orgId)
  return bookingDiscountListSchema.parse(discounts)
})
