// POST /api/v1/permission-groups — create one of the club's own permission groups
// (is_core false; sourceGroupId set = an override of a core template). Validates in
// against the create contract, returns the created group.
import { createPermissionGroup } from '../../../db/repositories/roles'
import { permissionGroupCreateSchema, permissionGroupSchema } from '../../../../shared/contracts/role'

export default defineEventHandler(async (event) => {
  const input = permissionGroupCreateSchema.parse(await readBody(event))
  return permissionGroupSchema.parse(await createPermissionGroup(input))
})
