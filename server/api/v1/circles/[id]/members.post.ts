// POST /api/v1/circles/:id/members — add a person to the circle with a role + optional
// capability/contact flags. Circle id from the path; the rest from the body.
import { addCircleMember } from '../../../../db/repositories/circles'
import { circleMemberCreateSchema, circleMemberSchema } from '../../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const circleId = getRouterParam(event, 'id')
  if (!circleId) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const input = circleMemberCreateSchema.parse({ ...(await readBody(event)), circleId })
  return circleMemberSchema.parse(await addCircleMember(input))
})
