// PATCH /api/v1/person-notes/:id — edit a note (body + audience/importance/due).
// Write side lives in the people repo (beside createNote/deleteNote).
import { updateNote } from '../../../db/repositories/people'
import { personNoteUpdateSchema } from '../../../../shared/contracts/personNote'
import { personNoteSchema } from '../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = personNoteUpdateSchema.parse(await readBody(event))
  const note = await updateNote(id, patch)
  return personNoteSchema.parse(note)
})
