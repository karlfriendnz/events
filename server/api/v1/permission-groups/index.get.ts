// GET /api/v1/permission-groups?orgId=… — the org's permission groups plus the core
// templates it inherits. The client only ever talks to routes like this, never to the
// database. Output is validated against the shared contract before it leaves, so the
// client's types are guaranteed.
import { listPermissionGroups } from '../../../db/repositories/roles'
import { permissionGroupListSchema } from '../../../../shared/contracts/role'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId as string | undefined
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const groups = await listPermissionGroups(orgId)
  // Parse-on-output: the route can never accidentally ship a shape the client
  // didn't agree to. Throws (500) if the repo drifts from the contract.
  return permissionGroupListSchema.parse(groups)
})
