// GET /api/v1/events/:id/communications — every message sent for an event, newest
// first. Output validated against the shared contract before it leaves.
import { listCommunicationsForEvent } from '../../../../db/repositories/events'
import { eventCommunicationListSchema } from '../../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return eventCommunicationListSchema.parse(await listCommunicationsForEvent(id))
})
