// POST /api/v1/scoped-roles — create a scoped-role definition.
import { createScopedRoleDef } from '../../../db/repositories/roles'
import { scopedRoleDefCreateSchema, scopedRoleDefSchema } from '../../../../shared/contracts/role'

export default defineEventHandler(async (event) => {
  const input = scopedRoleDefCreateSchema.parse(await readBody(event))
  return scopedRoleDefSchema.parse(await createScopedRoleDef(input))
})
