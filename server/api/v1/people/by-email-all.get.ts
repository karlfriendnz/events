// GET /api/v1/people/by-email-all?email= — every persons row across EVERY org matching
// a login's email (one per club) + that org's name/level. The cross-club identity read
// (useMyClubs). Cross-org by design. Output validated.
import { findAllPersonsByEmail } from '../../../db/repositories/people'
import { personWithOrgListSchema } from '../../../../shared/contracts/person'

export default defineEventHandler(async (event) => {
  const email = getQuery(event).email
  if (!email || typeof email !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'email required' })
  }
  return personWithOrgListSchema.parse(await findAllPersonsByEmail(email))
})
