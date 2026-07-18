// GET /api/v1/bookables/:id/booking-windows — a bookable's booking windows with their
// fixed slots folded in (the schedule editor + the venue page's master→linked copy).
import { listBookingWindows } from '../../../../db/repositories/bookings'
import { bookingWindowListSchema } from '../../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return bookingWindowListSchema.parse(await listBookingWindows(id))
})
