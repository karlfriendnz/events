// GET /api/v1/person-notes?personId=... — every note on a person, newest first. The
// client only ever talks to routes like this, never to the database. Output is
// validated against the shared contract before it leaves, so the client's types are
// guaranteed.
import { listNotes } from '../../../db/repositories/circles'
import { personNoteListSchema } from '../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const personId = getQuery(event).personId
  if (typeof personId !== 'string' || !personId) {
    throw createError({ statusCode: 400, statusMessage: 'personId is required' })
  }
  const notes = await listNotes(personId)
  return personNoteListSchema.parse(notes)
})
