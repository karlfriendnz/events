// POST /api/v1/bookings — create one booking (staff insert path).
import { createBooking } from '../../../db/repositories/bookings'
import { bookingCreateSchema, bookingSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const input = bookingCreateSchema.parse(await readBody(event))
  return bookingSchema.parse(await createBooking(input))
})
