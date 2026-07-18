// DELETE /api/v1/admin/permission-templates/:id — remove a core template.
import { deleteCorePermissionGroup } from '../../../../db/repositories/admin'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  await deleteCorePermissionGroup(id)
  return { ok: true }
})
