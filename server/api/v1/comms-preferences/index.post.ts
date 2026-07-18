// POST /api/v1/comms-preferences — upsert a preference on (personId, subjectPersonId).
// Idempotent: sets the categories for that pair, creating the row when absent.
import { setCommsPreference } from '../../../db/repositories/circles'
import { commsPreferenceUpsertSchema } from '../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const input = commsPreferenceUpsertSchema.parse(await readBody(event))
  await setCommsPreference(input)
  return { ok: true }
})
