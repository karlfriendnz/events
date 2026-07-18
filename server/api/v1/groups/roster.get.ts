// GET /api/v1/groups/roster?groupIds=a,b,c — memberships of many groups with role/
// roles + sub_group_id + person first/last name, for the term-rollover screen.
import { z } from 'zod'
import { listMembershipsRoster } from '../../../db/repositories/groups'

const outSchema = z.array(
  z.object({
    groupId: z.string(),
    personId: z.string(),
    role: z.string().nullable(),
    roles: z.array(z.string()),
    subGroupId: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
  }),
)

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const ids = typeof q.groupIds === 'string' && q.groupIds ? q.groupIds.split(',').filter(Boolean) : []
  return outSchema.parse(await listMembershipsRoster(ids))
})
