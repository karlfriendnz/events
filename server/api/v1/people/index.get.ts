// GET /api/v1/people — the public face of the seam for people. The client only ever
// talks to routes like this, never to the database. Scoped to one org (required),
// with optional paging + a name/email search. Output is validated against the
// shared contract before it leaves, so the client's types are guaranteed.
import { listPeople } from '../../../db/repositories/people'
import { personListSchema } from '../../../../shared/contracts/person'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const orgId = query.orgId ? String(query.orgId) : ''
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const limit = query.limit != null ? Number(query.limit) : undefined
  const offset = query.offset != null ? Number(query.offset) : undefined
  const q = query.q ? String(query.q) : undefined

  const people = await listPeople(orgId, { limit, offset, q })
  // Parse-on-output: the route can never accidentally ship a shape the client
  // didn't agree to. Throws (500) if the repo drifts from the contract.
  return personListSchema.parse(people)
})
