// DELETE /api/v1/permission-groups/:id?orgId= — delete one of the club's own groups
// (wipes its members first). orgId tenant-scopes the delete; a core template is
// untouchable.
import { deletePermissionGroup } from '../../../db/repositories/roles'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { orgId } = getQuery(event)
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  await deletePermissionGroup(id, String(orgId))
  return { ok: true }
})
