// GET /api/v1/admin/permission-templates — the core permission TEMPLATES
// (permission_groups where is_core=true, org_id=null) every club inherits. Carries
// description + the raw permissions map (super-admin editor shape).
import { listCorePermissionGroups } from '../../../../db/repositories/admin'
import { corePermissionGroupListSchema } from '../../../../../shared/contracts/admin'

export default defineEventHandler(async () => {
  const groups = await listCorePermissionGroups()
  return corePermissionGroupListSchema.parse(groups)
})
