// PATCH /api/v1/circles/members/:id — update one circle-member edge (role / capability
// / contact flags). ("members" is a static segment so it resolves before circles/[id].)
import { updateCircleMember } from '../../../../db/repositories/circles'
import { circleMemberPatchSchema } from '../../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = circleMemberPatchSchema.parse(await readBody(event))
  await updateCircleMember(id, patch)
  return { ok: true }
})
