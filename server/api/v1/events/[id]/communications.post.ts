// POST /api/v1/events/:id/communications — record a sent message against an event
// (the honest send row: real recipientCount, status SENT). Body validated against the
// shared contract; the created row parses-on-output.
import { createCommunication } from '../../../../db/repositories/events'
import { eventCommunicationCreateSchema, eventCommunicationSchema } from '../../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const body = eventCommunicationCreateSchema.parse(await readBody(event))
  return eventCommunicationSchema.parse(await createCommunication({ eventId: id, ...body }))
})
