// PATCH /api/v1/permission-groups/:id — update one of the club's own groups. orgId in
// the body tenant-scopes the WHERE (a core template can never be hit).
import { updatePermissionGroup } from '../../../db/repositories/roles'
import { permissionGroupPatchSchema, permissionGroupSchema } from '../../../../shared/contracts/role'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = permissionGroupPatchSchema.parse(await readBody(event))
  const updated = await updatePermissionGroup(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return permissionGroupSchema.parse(updated)
})
