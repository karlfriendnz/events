// GET /api/v1/bookings/:id — one booking WITH its display joins (bookable / activity /
// mode / event). The venue page's ?booking=<id> deep-link pops the edit dialog, which
// needs the joined names the flat booking row doesn't carry.
import { getBookingDetailed } from '../../../db/repositories/bookings'
import { bookingDetailSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const booking = await getBookingDetailed(id)
  if (!booking) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return bookingDetailSchema.parse(booking)
})
