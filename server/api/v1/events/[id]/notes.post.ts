// POST /api/v1/events/:id/notes — add a note to an event.
import { createEventNote } from '../../../../db/repositories/events'
import { eventNoteCreateSchema, eventNoteSchema } from '../../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const body = await readBody(event)
  const input = eventNoteCreateSchema.parse({ ...body, eventId: id })
  return eventNoteSchema.parse(await createEventNote(input))
})
