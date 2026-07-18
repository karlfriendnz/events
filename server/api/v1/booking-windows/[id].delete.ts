// DELETE /api/v1/booking-windows/:id — delete a window (and its fixed slots).
import { deleteBookingWindow } from '../../../db/repositories/bookings'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteBookingWindow(id)
  return { ok: true }
})
