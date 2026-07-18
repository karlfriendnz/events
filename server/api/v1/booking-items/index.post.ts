// POST /api/v1/booking-items — insert the equipment rows bundled with a booking (one
// row per item type + quantity). Body = BookingItemInput[]. The wizard calls this
// after the parent booking row exists. Returns nothing (204-style { ok: true }).
import { createBookingItems } from '../../../db/repositories/bookings'
import { bookingItemInputSchema } from '../../../../shared/contracts/booking'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const items = z.array(bookingItemInputSchema).parse(await readBody(event))
  await createBookingItems(items)
  return { ok: true }
})
