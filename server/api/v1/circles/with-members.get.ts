// GET /api/v1/circles/with-members?orgId=... — every circle in the org with its
// members hydrated (each member's person). The capability resolvers + the circles
// editor read this and filter per person. ("with-members" is a static segment.)
import { listCirclesForOrg } from '../../../db/repositories/circles'
import { circleWithMembersListSchema } from '../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  return circleWithMembersListSchema.parse(await listCirclesForOrg(orgId))
})
