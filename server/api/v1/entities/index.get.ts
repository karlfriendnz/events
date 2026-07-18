// GET /api/v1/entities?orgId=... — every entity record an org has. The client only
// ever talks to routes like this, never to the database. Output is validated against
// the shared contract before it leaves, so the client's types are guaranteed.
import { listEntities } from '../../../db/repositories/circles'
import { entityListSchema } from '../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const orgId = q.orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const typeKey = typeof q.typeKey === 'string' && q.typeKey ? q.typeKey : undefined
  const entities = await listEntities(orgId, typeKey)
  return entityListSchema.parse(entities)
})
