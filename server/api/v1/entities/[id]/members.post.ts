// POST /api/v1/entities/:id/members — attach a person to the entity with roles[]. The
// entity id comes from the path; the rest from the body. Returns the created edge.
import { addEntityMember } from '../../../../db/repositories/circles'
import { entityMemberCreateSchema, entityMemberSchema } from '../../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const entityId = getRouterParam(event, 'id')
  if (!entityId) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const input = entityMemberCreateSchema.parse({ ...(await readBody(event)), entityId })
  return entityMemberSchema.parse(await addEntityMember(input))
})
