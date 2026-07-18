// GET /api/v1/finances/registrations-for-person?personId= — one person's registrations
// (money owed/paid), for the profile Financials widget + member portal. Output validated.
import { listRegistrationsForPerson } from '../../../db/repositories/finances'
import { personRegistrationListSchema } from '../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const personId = getQuery(event).personId
  if (typeof personId !== 'string' || !personId) {
    throw createError({ statusCode: 400, statusMessage: 'personId required' })
  }
  return personRegistrationListSchema.parse(await listRegistrationsForPerson(personId))
})
