// GET /api/v1/resources?orgId=… — the resources in one org's library. The client
// only ever talks to routes like this, never to the database. Output is validated
// against the shared contract before it leaves, so the client's types are
// guaranteed.
import { listResources } from '../../../db/repositories/resources'
import { resourceListSchema } from '../../../../shared/contracts/resource'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const resources = await listResources(orgId)
  // Parse-on-output: the route can never accidentally ship a shape the client
  // didn't agree to. Throws (500) if the repo drifts from the contract.
  return resourceListSchema.parse(resources)
})
