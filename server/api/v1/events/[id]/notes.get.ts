// GET /api/v1/events/:id/notes — the notes on one event, newest first.
import { listEventNotes } from '../../../../db/repositories/events'
import { eventNoteListSchema } from '../../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return eventNoteListSchema.parse(await listEventNotes(id))
})
