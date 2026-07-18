// GET /api/v1/people/by-email?orgId=...&email=... — resolve a person by their email
// within an org (case-insensitive). The dashboard uses it to map the signed-in
// user's auth email to their person row (to pick a default dashboard / person-type
// keys). Returns the full person, or 404 when no match. Output validated.
import { findPersonByEmail } from '../../../db/repositories/people'
import { personSchema } from '../../../../shared/contracts/person'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const orgId = query.orgId ? String(query.orgId) : ''
  const email = query.email ? String(query.email) : ''
  if (!orgId || !email) {
    throw createError({ statusCode: 400, statusMessage: 'orgId and email are required' })
  }
  const person = await findPersonByEmail(orgId, email)
  if (!person) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return personSchema.parse(person)
})
