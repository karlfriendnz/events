// GET /api/v1/circles/:id/members — the members of one circle, in sort order. (Param is
// `id` to match the repo convention — see groups/[id]/memberships.get.ts.)
import { listCircleMembers } from '../../../../db/repositories/circles'
import { circleMemberListSchema } from '../../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const circleId = getRouterParam(event, 'id')
  if (!circleId) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return circleMemberListSchema.parse(await listCircleMembers(circleId))
})
