// GET /api/v1/org-sports?orgId=… — a club's sports + their governing-body
// affiliation. The client only ever talks to routes like this, never to the
// database. Output is validated against the shared contract before it leaves, so
// the client's types are guaranteed.
import { listOrgSports } from '../../../db/repositories/affiliations'
import { orgSportListSchema } from '../../../../shared/contracts/affiliation'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (!orgId || typeof orgId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const sports = await listOrgSports(orgId)
  // Parse-on-output: the route can never accidentally ship a shape the client
  // didn't agree to. Throws (500) if the repo drifts from the contract.
  return orgSportListSchema.parse(sports)
})
