// GET /api/v1/bookings/detailed?orgId=&status=&from=&to=&bookableIds=csv — an org's
// bookings WITH display joins (bookable / activity / mode / event), newest first. Backs
// the pending queue, which shows more than the flat booking row. Org-scoped via the
// bookable join, exactly like the flat list.
import { listBookingsDetailed } from '../../../db/repositories/bookings'
import { bookingDetailListSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const orgId = query.orgId
  if (typeof orgId !== 'string' || !orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  const bookableIds = typeof query.bookableIds === 'string' && query.bookableIds
    ? query.bookableIds.split(',').filter(Boolean)
    : undefined
  const rows = await listBookingsDetailed(orgId, {
    status: typeof query.status === 'string' ? query.status : undefined,
    from: typeof query.from === 'string' ? query.from : undefined,
    to: typeof query.to === 'string' ? query.to : undefined,
    bookableIds,
  })
  return bookingDetailListSchema.parse(rows)
})
