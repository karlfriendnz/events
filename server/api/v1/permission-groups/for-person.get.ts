// GET /api/v1/permission-groups/for-person?personId=… — the permission groups one
// person is directly assigned to, each with its grid. Backs the access resolvers
// (useCan effective-permission union + useAccessLevel legacy-group check).
import { listPermissionGroupsForPerson } from '../../../db/repositories/roles'
import { permissionGroupListSchema } from '../../../../shared/contracts/role'

export default defineEventHandler(async (event) => {
  const personId = getQuery(event).personId as string | undefined
  if (!personId) {
    throw createError({ statusCode: 400, statusMessage: 'personId is required' })
  }
  return permissionGroupListSchema.parse(await listPermissionGroupsForPerson(personId))
})
