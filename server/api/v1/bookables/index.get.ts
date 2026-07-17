// GET /api/v1/bookables?orgId=... — every bookable an org owns. The client only
// ever talks to routes like this, never to the database. Output is validated against
// the shared contract before it leaves, so the client's types are guaranteed.
import { listBookables } from '../../../db/repositories/bookings'
import { bookableListSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const bookables = await listBookables(orgId)
  // Parse-on-output: the route can never ship a shape the client didn't agree to.
  return bookableListSchema.parse(bookables)
})
