// GET /api/v1/term-sets?orgId=... — every term set (sequence) an org has. The client
// only ever talks to routes like this, never to the database. Output is validated
// against the shared contract before it leaves, so the client's types are guaranteed.
import { listTermSets } from '../../../db/repositories/memberships'
import { termSetListSchema } from '../../../../shared/contracts/membership'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const sets = await listTermSets(orgId)
  // Parse-on-output: the route can never ship a shape the client didn't agree to.
  return termSetListSchema.parse(sets)
})
