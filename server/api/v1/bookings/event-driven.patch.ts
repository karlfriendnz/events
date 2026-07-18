// PATCH /api/v1/bookings/event-driven?eventId= — re-time an event's active EVENT_DRIVEN
// venue bookings (body: { startAt, endAt, isAllDay }) when the event's own time moves.
import { z } from 'zod'
import { updateEventDrivenBookingTimes } from '../../../db/repositories/bookings'

const bodySchema = z.object({
  startAt: z.string(),
  endAt: z.string(),
  isAllDay: z.boolean().default(false),
})

export default defineEventHandler(async (event) => {
  const { eventId } = getQuery(event)
  if (!eventId || typeof eventId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'eventId required' })
  }
  const times = bodySchema.parse(await readBody(event))
  await updateEventDrivenBookingTimes(eventId, times)
  return { ok: true }
})
