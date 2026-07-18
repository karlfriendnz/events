// GET /api/v1/person-notes?personId=... [or ?personIds=csv] — notes on a person (or a
// SET of people, for roster note-count badges), newest first. The client only ever
// talks to routes like this, never to the database. Output is validated against the
// shared contract before it leaves, so the client's types are guaranteed.
import { listNotes, listNotesForPeople } from '../../../db/repositories/circles'
import { personNoteListSchema } from '../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const { personId, personIds } = getQuery(event)
  if (typeof personIds === 'string' && personIds.length) {
    return personNoteListSchema.parse(await listNotesForPeople(personIds.split(',')))
  }
  if (typeof personId !== 'string' || !personId) {
    throw createError({ statusCode: 400, statusMessage: 'personId or personIds is required' })
  }
  return personNoteListSchema.parse(await listNotes(personId))
})
