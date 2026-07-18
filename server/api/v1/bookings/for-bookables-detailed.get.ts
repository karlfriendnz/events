// GET /api/v1/bookings/for-bookables-detailed?bookableIds=csv&from=&to=&excludeCancelled=1
// — bookings on a SET of bookables WITH display joins (bookable / activity / mode /
// event). The sub-venue scheduler renders the event title per child column and has no
// org context, so it reads by bookable ids (which are org-owned) here.
import { listBookingsDetailedForBookables } from '../../../db/repositories/bookings'
import { bookingDetailListSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const bookableIds = typeof query.bookableIds === 'string' && query.bookableIds
    ? query.bookableIds.split(',').filter(Boolean)
    : []
  if (!bookableIds.length) return bookingDetailListSchema.parse([])
  const rows = await listBookingsDetailedForBookables(bookableIds, {
    overlapStart: typeof query.overlapStart === 'string' ? query.overlapStart : undefined,
    overlapEnd: typeof query.overlapEnd === 'string' ? query.overlapEnd : undefined,
    from: typeof query.from === 'string' ? query.from : undefined,
    to: typeof query.to === 'string' ? query.to : undefined,
    excludeCancelled: query.excludeCancelled === '1' || query.excludeCancelled === 'true',
    status: typeof query.status === 'string' ? query.status : undefined,
  })
  return bookingDetailListSchema.parse(rows)
})
