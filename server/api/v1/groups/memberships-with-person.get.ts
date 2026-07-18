// GET /api/v1/groups/memberships-with-person?groupIds=a,b,c — memberships of a set of
// groups, each with the person's display fields. Feeds the team allocator's pools.
import { z } from 'zod'
import { listMembershipsWithPersonForGroups } from '../../../db/repositories/groups'

const outSchema = z.array(
  z.object({
    groupId: z.string(),
    personId: z.string(),
    role: z.string().nullable(),
    roles: z.array(z.string()),
    person: z
      .object({
        id: z.string(),
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
        email: z.string().nullable(),
        phone: z.string().nullable(),
        dob: z.string().nullable(),
        gender: z.string().nullable(),
      })
      .nullable(),
  }),
)

export default defineEventHandler(async (event) => {
  const raw = getQuery(event).groupIds
  const ids = typeof raw === 'string' && raw ? raw.split(',').filter(Boolean) : []
  return outSchema.parse(await listMembershipsWithPersonForGroups(ids))
})
