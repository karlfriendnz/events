// POST /api/v1/admin/permission-templates — create a core permission template.
import { createCorePermissionGroup } from '../../../../db/repositories/admin'
import { corePermissionGroupCreateSchema, corePermissionGroupSchema } from '../../../../../shared/contracts/admin'

export default defineEventHandler(async (event) => {
  const input = corePermissionGroupCreateSchema.parse(await readBody(event))
  const group = await createCorePermissionGroup(input)
  return corePermissionGroupSchema.parse(group)
})
