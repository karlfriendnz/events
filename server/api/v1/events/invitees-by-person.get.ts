// GET /api/v1/events/invitees-by-person?personId= — every invitee row for one
// person across all events, enriched with each event's title/start/status. Feeds the
// profile activity feed. Output validated against the shared contract. (gap D9)
import { inviteesForPerson } from '../../../db/repositories/events'
import { inviteeForPersonListSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const { personId } = getQuery(event)
  if (!personId || typeof personId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'personId required' })
  }
  return inviteeForPersonListSchema.parse(await inviteesForPerson(personId))
})
