// DELETE /api/v1/person-notes/:id — remove a note. Write side lives in the people
// repo (beside createNote), the circles domain owning only note reads.
import { deleteNote } from '../../../db/repositories/people'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteNote(id)
  return { ok: true }
})
