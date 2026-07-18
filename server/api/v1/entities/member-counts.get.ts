// GET /api/v1/entities/member-counts?orgId=... — { [entityId]: attach count } across
// the org's entity roster, for the directory's attach badge. ("member-counts" is a
// static segment so it resolves before the dynamic [id] route.)
import { entityMemberCounts } from '../../../db/repositories/circles'
import { entityMemberCountsSchema } from '../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  return entityMemberCountsSchema.parse(await entityMemberCounts(orgId))
})
