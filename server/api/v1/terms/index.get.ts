// GET /api/v1/terms?orgId=... — every term/season an org defines. The client only
// ever talks to routes like this, never to the database. Output is validated against
// the shared contract before it leaves, so the client's types are guaranteed.
import { listTerms } from '../../../db/repositories/memberships'
import { orgTermListSchema } from '../../../../shared/contracts/membership'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const terms = await listTerms(orgId)
  // Parse-on-output: the route can never ship a shape the client didn't agree to.
  return orgTermListSchema.parse(terms)
})
