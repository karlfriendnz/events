// GET /api/v1/group-codes?orgId=... — every code an org defines. The client only
// ever talks to routes like this, never to the database. Output is validated against
// the shared contract before it leaves, so the client's types are guaranteed.
import { listCodes } from '../../../db/repositories/groups'
import { groupCodeListSchema } from '../../../../shared/contracts/group'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const codes = await listCodes(orgId)
  return groupCodeListSchema.parse(codes)
})
