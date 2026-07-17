// GET /api/v1/calendars?orgId= — the club's named calendars. The client only ever
// talks to routes like this, never to the database. Output is validated against the
// shared contract before it leaves, so the client's types are guaranteed.
import { listCalendars } from '../../../db/repositories/waitlists'
import { calendarListSchema } from '../../../../shared/contracts/waitlist'

export default defineEventHandler(async (event) => {
  const { orgId } = getQuery(event)
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const calendars = await listCalendars(String(orgId))
  return calendarListSchema.parse(calendars)
})
