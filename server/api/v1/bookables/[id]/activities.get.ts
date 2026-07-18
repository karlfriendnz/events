// GET /api/v1/bookables/:id/activities — every activity linked to (or tagged with)
// this bookable. The staff "What I offer" tab uses it to resolve a PERSON bookable's
// owning activity.
import { listActivitiesForBookable } from '../../../../db/repositories/bookings'
import { activityListSchema } from '../../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return activityListSchema.parse(await listActivitiesForBookable(id))
})
