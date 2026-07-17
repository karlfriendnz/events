// GET /api/v1/person-types?orgId=… — the public face of the seam for person types.
// The client only ever talks to routes like this, never to the database. Output is
// validated against the shared contract before it leaves, so the client's types
// are guaranteed.
import { listPersonTypes } from '../../../db/repositories/personTypes'
import { personTypeListSchema } from '../../../../shared/contracts/personType'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const types = await listPersonTypes(orgId)
  // Parse-on-output: the route can never accidentally ship a shape the client
  // didn't agree to. Throws (500) if the repo drifts from the contract.
  return personTypeListSchema.parse(types)
})
