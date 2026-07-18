// GET /api/v1/groups/memberships?orgId=… — every group membership in an org as
// (person, group, location) refs. Feeds the People directory's location lens; the
// per-group roster lives at /groups/:id/memberships instead. Output parsed on the way
// out with an inline schema (a thin projection, not a domain object).
import { z } from 'zod'
import { listMembershipsByOrg, listMembershipsForPerson } from '../../../db/repositories/groups'

const outSchema = z.array(
  z.object({
    personId: z.string(),
    groupId: z.string(),
    locationId: z.string().nullable(),
    // codeId (mig 205) — the class's code, for deriving its effective sport (access lens).
    codeId: z.string().nullable(),
    // role/roles (mig 183) — needed by retention + the staff-vs-member split.
    role: z.string().nullable(),
    roles: z.array(z.string()),
  }),
)

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const orgId = q.orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  // personId mode: one person's memberships (profile Membership tab / syncGroups).
  if (typeof q.personId === 'string' && q.personId) {
    return outSchema.parse(await listMembershipsForPerson(orgId, q.personId))
  }
  return outSchema.parse(await listMembershipsByOrg(orgId))
})
