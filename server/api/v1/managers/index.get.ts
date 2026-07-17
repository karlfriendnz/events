// GET /api/v1/managers?orgId=… — the cross-club manager grants a governing org has
// issued. The client only ever talks to routes like this, never to the database.
// Output is validated against the shared contract before it leaves.
import { listManagerGrants } from '../../../db/repositories/affiliations'
import { orgManagerGrantListSchema } from '../../../../shared/contracts/affiliation'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (!orgId || typeof orgId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const grants = await listManagerGrants(orgId)
  // Parse-on-output: throws (500) if the repo drifts from the contract.
  return orgManagerGrantListSchema.parse(grants)
})
