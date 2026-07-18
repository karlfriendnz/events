// PATCH /api/v1/admin/permission-templates/:id — update a core template (name /
// description / permissions / sort order). Scoped to is_core rows in the repo.
import { updateCorePermissionGroup } from '../../../../db/repositories/admin'
import { corePermissionGroupPatchSchema, corePermissionGroupSchema } from '../../../../../shared/contracts/admin'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  const patch = corePermissionGroupPatchSchema.parse(await readBody(event))
  const group = await updateCorePermissionGroup(id, patch)
  if (!group) throw createError({ statusCode: 404, statusMessage: 'Template not found' })
  return corePermissionGroupSchema.parse(group)
})
