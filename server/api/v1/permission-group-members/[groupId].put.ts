// PUT /api/v1/permission-group-members/:groupId — replace a group's whole membership
// (delete-then-insert). Body { orgId, personIds }; orgId tenant-scopes which group can
// be written (the group id alone is never trusted).
import { setPermissionGroupMembers } from '../../../db/repositories/roles'
import { permissionGroupMembersSetSchema } from '../../../../shared/contracts/role'

export default defineEventHandler(async (event) => {
  const groupId = getRouterParam(event, 'groupId')
  if (!groupId) throw createError({ statusCode: 400, statusMessage: 'groupId required' })
  const body = permissionGroupMembersSetSchema.parse(await readBody(event))
  await setPermissionGroupMembers(groupId, body.orgId, body.personIds)
  return { ok: true }
})
