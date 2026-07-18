// GET /api/v1/booking-items/usage?bookableIds=csv&overlapStart=&overlapEnd= — the
// summed quantity of each item bookable already reserved by non-cancelled bookings
// overlapping the proposed window. Feeds the wizard's equipment-availability check.
// The bookable ids are org-owned, so this stays tenant-safe without an explicit orgId.
import { bookingItemUsage } from '../../../db/repositories/bookings'
import { bookingItemUsageSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const bookableIds = typeof query.bookableIds === 'string' && query.bookableIds
    ? query.bookableIds.split(',').filter(Boolean)
    : []
  if (!bookableIds.length) return bookingItemUsageSchema.parse({})
  const used = await bookingItemUsage(bookableIds, {
    overlapStart: typeof query.overlapStart === 'string' ? query.overlapStart : undefined,
    overlapEnd: typeof query.overlapEnd === 'string' ? query.overlapEnd : undefined,
  })
  return bookingItemUsageSchema.parse(used)
})
