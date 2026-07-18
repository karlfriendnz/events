// DELETE /api/v1/bookings/:id
import { deleteBooking } from '../../../db/repositories/bookings'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteBooking(id)
  return { ok: true }
})
