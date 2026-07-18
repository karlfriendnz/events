// PATCH /api/v1/booking-windows/:id — update a window. A `slots` array in the body
// replaces the window's fixed slots; omitting it leaves them untouched.
import { updateBookingWindow } from '../../../db/repositories/bookings'
import { bookingWindowPatchSchema, bookingWindowSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = bookingWindowPatchSchema.parse(await readBody(event))
  const updated = await updateBookingWindow(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return bookingWindowSchema.parse(updated)
})
