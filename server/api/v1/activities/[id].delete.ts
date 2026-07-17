// DELETE /api/v1/activities/:id
import { deleteActivity } from '../../../db/repositories/bookings'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteActivity(id)
  return { ok: true }
})
