// GET /api/v1/scoped-roles?orgId=… — the org's scoped-role catalogue. The client
// only ever talks to routes like this, never to the database. Output is validated
// against the shared contract before it leaves, so the client's types are guaranteed.
import { listScopedRoleDefs } from '../../../db/repositories/roles'
import { scopedRoleDefListSchema } from '../../../../shared/contracts/role'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId as string | undefined
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const roles = await listScopedRoleDefs(orgId)
  // Parse-on-output: the route can never accidentally ship a shape the client
  // didn't agree to. Throws (500) if the repo drifts from the contract.
  return scopedRoleDefListSchema.parse(roles)
})
