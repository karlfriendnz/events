// GET /api/v1/activities/:id/modes — the modes of one activity.
import { listActivityModes } from '../../../../db/repositories/bookings'
import { activityModeListSchema } from '../../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return activityModeListSchema.parse(await listActivityModes(id))
})
