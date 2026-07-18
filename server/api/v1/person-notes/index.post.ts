// POST /api/v1/person-notes — add a note to a person. The READ side lives in the
// circles domain (index.get.ts → listNotes); the WRITE lives in the people repo so
// note creation has a seam without another domain growing note-write functions.
// Input validated against the create contract; output against the circle read shape.
import { createNote } from '../../../db/repositories/people'
import { personNoteCreateSchema } from '../../../../shared/contracts/personNote'
import { personNoteSchema } from '../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const input = personNoteCreateSchema.parse(await readBody(event))
  const note = await createNote(input)
  return personNoteSchema.parse(note)
})
