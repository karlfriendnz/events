// GET /api/v1/groups/memberships-for-retention?groupIds=a,b,c — memberships of a set
// of groups with membership start_date + person name/email/phone/created_at, for the
// retention report. member_group_memberships has no org_id; the group ids are trusted.
import { z } from 'zod'
import { listMembershipsForRetention } from '../../../db/repositories/groups'

const outSchema = z.array(
  z.object({
    groupId: z.string(),
    personId: z.string(),
    role: z.string().nullable(),
    roles: z.array(z.string()),
    startDate: z.string().nullable(),
    person: z
      .object({
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
        email: z.string().nullable(),
        phone: z.string().nullable(),
        createdAt: z.string().nullable(),
      })
      .nullable(),
  }),
)

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const ids = typeof q.groupIds === 'string' && q.groupIds ? q.groupIds.split(',').filter(Boolean) : []
  return outSchema.parse(await listMembershipsForRetention(ids))
})
