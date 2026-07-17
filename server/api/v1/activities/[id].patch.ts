// PATCH /api/v1/activities/:id — partial update.
import { updateActivity } from '../../../db/repositories/bookings'
import { activityPatchSchema, activitySchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = activityPatchSchema.parse(await readBody(event))
  const updated = await updateActivity(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return activitySchema.parse(updated)
})
