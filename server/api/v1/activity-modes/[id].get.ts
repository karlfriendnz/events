// GET /api/v1/activity-modes/:id — one mode.
import { getActivityMode } from '../../../db/repositories/bookings'
import { activityModeSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const m = await getActivityMode(id)
  if (!m) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return activityModeSchema.parse(m)
})
