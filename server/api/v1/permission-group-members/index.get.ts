// GET /api/v1/permission-group-members?orgId=… — the person ids who hold a (legacy)
// permission group in an org. The People directory's Admins tab uses it to flag people
// with access via the old RBAC path. A thin id list, parsed on output inline.
import { z } from 'zod'
import { listPermissionGroupMemberPersonIds } from '../../../db/repositories/roles'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const ids = await listPermissionGroupMemberPersonIds(orgId)
  return z.array(z.string()).parse(ids)
})
