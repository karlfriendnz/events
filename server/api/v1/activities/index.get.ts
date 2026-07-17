// GET /api/v1/activities?orgId=... — every activity an org offers. The client only
// ever talks to routes like this, never to the database. Output is validated against
// the shared contract before it leaves, so the client's types are guaranteed.
import { listActivities } from '../../../db/repositories/bookings'
import { activityListSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const activities = await listActivities(orgId)
  // Parse-on-output: the route can never ship a shape the client didn't agree to.
  return activityListSchema.parse(activities)
})
