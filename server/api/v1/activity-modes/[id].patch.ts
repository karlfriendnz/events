// PATCH /api/v1/activity-modes/:id — partial update.
import { updateActivityMode } from '../../../db/repositories/bookings'
import { activityModePatchSchema, activityModeSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = activityModePatchSchema.parse(await readBody(event))
  const updated = await updateActivityMode(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return activityModeSchema.parse(updated)
})
