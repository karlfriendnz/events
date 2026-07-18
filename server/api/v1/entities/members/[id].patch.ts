// PATCH /api/v1/entities/members/:id — change the roles[] on one roster edge. ("members"
// is a static segment so it resolves before entities/[id].)
import { updateEntityMember } from '../../../../db/repositories/circles'
import { entityMemberPatchSchema } from '../../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = entityMemberPatchSchema.parse(await readBody(event))
  await updateEntityMember(id, patch.roles)
  return { ok: true }
})
