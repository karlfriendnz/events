// GET /api/v1/person-type-links?orgId=… — inheritance edges (a club type sourced
// from an NSO type). The client only ever talks to routes like this, never to the
// database. Output is validated against the shared contract before it leaves.
import { listPersonTypeLinks } from '../../../db/repositories/personTypes'
import { personTypeLinkListSchema } from '../../../../shared/contracts/personType'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const links = await listPersonTypeLinks(orgId)
  return personTypeLinkListSchema.parse(links)
})
