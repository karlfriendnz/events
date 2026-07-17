// PATCH /api/v1/groups/:id — partial update. Coexists with the [id]/ dir
// (memberships/schedules/fee-options) — different route, no conflict.
import { updateGroup } from '../../../db/repositories/groups'
import { memberGroupPatchSchema, memberGroupSchema } from '../../../../shared/contracts/group'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = memberGroupPatchSchema.parse(await readBody(event))
  const updated = await updateGroup(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return memberGroupSchema.parse(updated)
})
