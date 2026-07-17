// GET /api/v1/groups?orgId=... — every group an org has. The client only ever talks
// to routes like this, never to the database. Output is validated against the shared
// contract before it leaves, so the client's types are guaranteed.
import { listGroups } from '../../../db/repositories/groups'
import { memberGroupListSchema } from '../../../../shared/contracts/group'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const groups = await listGroups(orgId)
  // Parse-on-output: the route can never ship a shape the client didn't agree to.
  return memberGroupListSchema.parse(groups)
})
