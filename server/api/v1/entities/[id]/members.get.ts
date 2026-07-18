// GET /api/v1/entities/:id/members — the entity's roster, each attached person
// hydrated (name + contact). Output validated against the shared contract. (Param is
// `id` to match the repo convention — see groups/[id]/memberships.get.ts.)
import { listEntityMembersHydrated } from '../../../../db/repositories/circles'
import { entityMemberWithPersonListSchema } from '../../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const entityId = getRouterParam(event, 'id')
  if (!entityId) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return entityMemberWithPersonListSchema.parse(await listEntityMembersHydrated(entityId))
})
