// GET /api/v1/activities/:id — one activity.
import { getActivity } from '../../../db/repositories/bookings'
import { activitySchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const a = await getActivity(id)
  if (!a) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return activitySchema.parse(a)
})
