// GET /api/v1/event-org-invitees?eventId= — the clubs invited to an event.
import { listEventOrgInvitees } from '../../../db/repositories/events'
import { eventOrgInviteeListSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const eventId = getQuery(event).eventId as string
  if (!eventId) throw createError({ statusCode: 400, statusMessage: 'eventId required' })
  return eventOrgInviteeListSchema.parse(await listEventOrgInvitees(eventId))
})
