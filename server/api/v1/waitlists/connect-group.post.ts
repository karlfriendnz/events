// POST /api/v1/waitlists/connect-group — connect one group to a waitlist (or null to
// disconnect it). Body = { groupId, waitlistId }.
import { z } from 'zod'
import { connectGroupToWaitlist } from '../../../db/repositories/groups'

const inSchema = z.object({ groupId: z.string(), waitlistId: z.string().nullable() })

export default defineEventHandler(async (event) => {
  const parsed = inSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  await connectGroupToWaitlist(parsed.data.groupId, parsed.data.waitlistId)
  return { ok: true }
})
