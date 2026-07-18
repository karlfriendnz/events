// GET /api/v1/permission-group-members?orgId=… — the person ids who hold a (legacy)
// permission group in an org (the People directory's Admins tab uses this to flag
// people with access). Add `&byGroup=1` to get the full membership EDGES
// ({ groupId, personId }[]) the permission-group editor needs to map members to their
// groups. Parsed on output.
import { z } from 'zod'
import {
  listPermissionGroupMemberPersonIds,
  listPermissionGroupMembersByOrg,
} from '../../../db/repositories/roles'
import { permissionGroupMemberListSchema } from '../../../../shared/contracts/role'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const orgId = q.orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  if (q.byGroup) {
    return permissionGroupMemberListSchema.parse(await listPermissionGroupMembersByOrg(orgId))
  }
  const ids = await listPermissionGroupMemberPersonIds(orgId)
  return z.array(z.string()).parse(ids)
})
