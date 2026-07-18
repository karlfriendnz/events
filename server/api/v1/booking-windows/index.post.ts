// POST /api/v1/booking-windows — create a booking window (with its fixed slots inline).
import { createBookingWindow } from '../../../db/repositories/bookings'
import { bookingWindowCreateSchema, bookingWindowSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const input = bookingWindowCreateSchema.parse(await readBody(event))
  return bookingWindowSchema.parse(await createBookingWindow(input))
})
