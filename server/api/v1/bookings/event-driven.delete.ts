// DELETE /api/v1/bookings/event-driven?eventId= — clear the EVENT_DRIVEN calendar
// bookings an event materialised on its linked venues (so a re-save doesn't duplicate
// them). type-scoped to EVENT_DRIVEN — never a real customer booking.
import { deleteEventDrivenBookings } from '../../../db/repositories/bookings'

export default defineEventHandler(async (event) => {
  const { eventId } = getQuery(event)
  if (!eventId || typeof eventId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'eventId required' })
  }
  await deleteEventDrivenBookings(eventId)
  return { ok: true }
})
