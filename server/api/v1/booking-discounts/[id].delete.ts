// DELETE /api/v1/booking-discounts/:id
import { deleteBookingDiscount } from '../../../db/repositories/bookings'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteBookingDiscount(id)
  return { ok: true }
})
