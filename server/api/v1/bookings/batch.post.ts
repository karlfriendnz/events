// POST /api/v1/bookings/batch — create many bookings at once (a multi-bookable slot
// reservation: one primary + N children sharing parent_booking_id). Body =
// BookingCreate[]. Returns them all.
import { createBookings } from '../../../db/repositories/bookings'
import { bookingCreateSchema, bookingListSchema } from '../../../../shared/contracts/booking'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const inputs = z.array(bookingCreateSchema).parse(await readBody(event))
  return bookingListSchema.parse(await createBookings(inputs))
})
