// PATCH /api/v1/scoped-roles/:id — partial update.
import { updateScopedRoleDef } from '../../../db/repositories/roles'
import { scopedRoleDefPatchSchema, scopedRoleDefSchema } from '../../../../shared/contracts/role'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = scopedRoleDefPatchSchema.parse(await readBody(event))
  const updated = await updateScopedRoleDef(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return scopedRoleDefSchema.parse(updated)
})
