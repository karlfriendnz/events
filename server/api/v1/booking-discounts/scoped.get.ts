// GET /api/v1/booking-discounts/scoped?orgId=...&activeOnly=1 — booking discounts
// WITH their activity/mode scope folded in as id arrays (the booking flow +
// BookingDiscountsList need the scope; the finances read at index.get does not, so
// it stays a separate, finance-owned route to avoid clobbering it).
import { listBookingDiscounts } from '../../../db/repositories/bookings'
import { bookingDiscountListSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const orgId = q.orgId
  if (typeof orgId !== 'string' || !orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  const activeOnly = q.activeOnly === '1' || q.activeOnly === 'true'
  return bookingDiscountListSchema.parse(await listBookingDiscounts(orgId, { activeOnly }))
})
