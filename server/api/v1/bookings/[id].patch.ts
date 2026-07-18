// PATCH /api/v1/bookings/:id — update a booking. Body = a partial booking (the calendar
// drag sends { startAt, endAt }; the venue edit dialog sends status/contacts/activity/
// mode/bookable/custom_fields; the pending queue sends just { status }). All provided
// fields are written; the rest are left untouched.
import { updateBooking } from '../../../db/repositories/bookings'
import { bookingPatchSchema, bookingSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = bookingPatchSchema.parse(await readBody(event))
  const updated = await updateBooking(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return bookingSchema.parse(updated)
})
