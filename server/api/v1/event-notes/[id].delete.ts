// DELETE /api/v1/event-notes/:id — remove a note.
import { deleteEventNote } from '../../../db/repositories/events'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteEventNote(id)
  return { ok: true }
})
