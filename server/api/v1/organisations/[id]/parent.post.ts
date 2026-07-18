// POST /api/v1/organisations/:id/parent — privileged re-parent (move an org under a
// different governing body). Its own endpoint, deliberately NOT the general patch
// (security audit CRIT-3): the security model gates this. Body { parentId }.
import { setOrgParent } from '../../../../db/repositories/organisations'
import { orgSetParentSchema } from '../../../../../shared/contracts/organisation'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { parentId } = orgSetParentSchema.parse(await readBody(event))
  await setOrgParent(id, parentId)
  return { ok: true }
})
