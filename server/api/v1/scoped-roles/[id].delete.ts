// DELETE /api/v1/scoped-roles/:id
import { deleteScopedRoleDef } from '../../../db/repositories/roles'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteScopedRoleDef(id)
  return { ok: true }
})
