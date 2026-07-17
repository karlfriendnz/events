// GET /api/v1/locations?orgId=… — a club's operational sites. The client only ever
// talks to routes like this, never to the database. Output is validated against the
// shared contract before it leaves.
import { listLocations } from '../../../db/repositories/affiliations'
import { locationListSchema } from '../../../../shared/contracts/affiliation'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (!orgId || typeof orgId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const locations = await listLocations(orgId)
  // Parse-on-output: throws (500) if the repo drifts from the contract.
  return locationListSchema.parse(locations)
})
