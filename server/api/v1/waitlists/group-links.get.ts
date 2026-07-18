// GET /api/v1/waitlists/group-links?orgId= — the groups connected to each waitlist
// (member_groups.waitlist_id). Returns a flat list [{ id, name, color, waitlistId }];
// the composable buckets them per waitlist.
import { z } from 'zod'
import { listWaitlistGroupLinks } from '../../../db/repositories/groups'

const outSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    color: z.string().nullable(),
    waitlistId: z.string(),
  }),
)

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId as string | undefined
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  return outSchema.parse(await listWaitlistGroupLinks(orgId))
})
