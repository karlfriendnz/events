// GET /api/v1/bookings?orgId=...&limit=&offset= — an org's bookings, newest first.
// The client only ever talks to routes like this, never to the database. Output is
// validated against the shared contract before it leaves, so the client's types are
// guaranteed. There is no org_id on bookings — the repository scopes via a JOIN to
// the bookable and carries that org_id onto each domain object.
import { listBookings } from '../../../db/repositories/bookings'
import { bookingListSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const orgId = query.orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const limit = query.limit != null ? Number(query.limit) : undefined
  const offset = query.offset != null ? Number(query.offset) : undefined
  const bookings = await listBookings(orgId, {
    limit: Number.isFinite(limit) ? limit : undefined,
    offset: Number.isFinite(offset) ? offset : undefined,
  })
  // Parse-on-output: the route can never ship a shape the client didn't agree to.
  return bookingListSchema.parse(bookings)
})
