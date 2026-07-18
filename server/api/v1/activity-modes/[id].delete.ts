// DELETE /api/v1/activity-modes/:id
import { deleteActivityMode } from '../../../db/repositories/bookings'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteActivityMode(id)
  return { ok: true }
})
