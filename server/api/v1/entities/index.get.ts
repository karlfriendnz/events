// GET /api/v1/entities?orgId=... — every entity record an org has. The client only
// ever talks to routes like this, never to the database. Output is validated against
// the shared contract before it leaves, so the client's types are guaranteed.
import { listEntities } from '../../../db/repositories/circles'
import { entityListSchema } from '../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const entities = await listEntities(orgId)
  return entityListSchema.parse(entities)
})
