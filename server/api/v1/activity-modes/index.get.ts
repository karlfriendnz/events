// GET /api/v1/activity-modes?orgId=... — every activity mode across an org's activities,
// in one query. Replaces the N+1 per-activity fan-out the venue edit dialog + the
// availability editor used to resolve a booking's mode name/colour.
import { listActivityModesForOrg } from '../../../db/repositories/bookings'
import { activityModeListSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  return activityModeListSchema.parse(await listActivityModesForOrg(orgId))
})
