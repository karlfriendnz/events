// GET /api/v1/groups/memberships?orgId=… — every group membership in an org as
// (person, group, location) refs. Feeds the People directory's location lens; the
// per-group roster lives at /groups/:id/memberships instead. Output parsed on the way
// out with an inline schema (a thin projection, not a domain object).
import { z } from 'zod'
import { listMembershipsByOrg } from '../../../db/repositories/groups'

const outSchema = z.array(
  z.object({
    personId: z.string(),
    groupId: z.string(),
    locationId: z.string().nullable(),
  }),
)

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const rows = await listMembershipsByOrg(orgId)
  return outSchema.parse(rows)
})
