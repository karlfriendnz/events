// GET /api/v1/bookings/for-bookables?bookableIds=csv&overlapStart=&overlapEnd=&from=&to=
//   &excludeCancelled=1&status= — the flat bookings on a SET of bookables, for the
// overlap/clash pre-flights (wizard, scheduler, item booker) and by-bookable calendar
// windows (availability editor, sub-venue scheduler).
//   overlapStart/overlapEnd → TRUE interval overlap (start_at < overlapEnd AND
//     end_at > overlapStart).
//   from/to → a window against start_at.
// The bookable ids are org-owned, so this stays tenant-safe without an explicit orgId.
import { listBookingsForBookables } from '../../../db/repositories/bookings'
import { bookingListSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const bookableIds = typeof query.bookableIds === 'string' && query.bookableIds
    ? query.bookableIds.split(',').filter(Boolean)
    : []
  if (!bookableIds.length) return bookingListSchema.parse([])
  const rows = await listBookingsForBookables(bookableIds, {
    overlapStart: typeof query.overlapStart === 'string' ? query.overlapStart : undefined,
    overlapEnd: typeof query.overlapEnd === 'string' ? query.overlapEnd : undefined,
    from: typeof query.from === 'string' ? query.from : undefined,
    to: typeof query.to === 'string' ? query.to : undefined,
    excludeCancelled: query.excludeCancelled === '1' || query.excludeCancelled === 'true',
    status: typeof query.status === 'string' ? query.status : undefined,
  })
  return bookingListSchema.parse(rows)
})
