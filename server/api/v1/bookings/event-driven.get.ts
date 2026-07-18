// GET /api/v1/bookings/event-driven?eventId= — the EVENT_DRIVEN venue bookings an event
// has materialised (id + bookable + status), for the venue-sync diff.
import { z } from 'zod'
import { eventDrivenBookings } from '../../../db/repositories/bookings'

const schema = z.array(z.object({ id: z.string(), bookableId: z.string(), status: z.string() }))

export default defineEventHandler(async (event) => {
  const { eventId } = getQuery(event)
  if (!eventId || typeof eventId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'eventId required' })
  }
  return schema.parse(await eventDrivenBookings(eventId))
})
