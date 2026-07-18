// GET /api/v1/comms-preferences?personId=...  → prefs a recipient set (keyed to them)
// GET /api/v1/comms-preferences?subjectPersonId=... → prefs about a subject (the inverse
//   view: everyone who receives that subject's comms). Exactly one query param is used.
import {
  listCommsPreferences,
  listCommsPreferencesForSubject,
} from '../../../db/repositories/circles'
import { commsPreferenceListSchema } from '../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const personId = typeof q.personId === 'string' ? q.personId : ''
  const subjectPersonId = typeof q.subjectPersonId === 'string' ? q.subjectPersonId : ''
  if (!personId && !subjectPersonId) {
    throw createError({ statusCode: 400, statusMessage: 'personId or subjectPersonId is required' })
  }
  const rows = subjectPersonId
    ? await listCommsPreferencesForSubject(subjectPersonId)
    : await listCommsPreferences(personId)
  return commsPreferenceListSchema.parse(rows)
})
