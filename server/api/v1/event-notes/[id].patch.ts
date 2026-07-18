// PATCH /api/v1/event-notes/:id — edit a note.
import { updateEventNote } from '../../../db/repositories/events'
import { eventNotePatchSchema, eventNoteSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = eventNotePatchSchema.parse(await readBody(event))
  const row = await updateEventNote(id, patch)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return eventNoteSchema.parse(row)
})
