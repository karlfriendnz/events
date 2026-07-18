// POST /api/v1/waitlists/set-groups — set exactly which groups a waitlist holds
// (connect the chosen, disconnect the rest). Body = { waitlistId, groupIds }.
import { z } from 'zod'
import { setWaitlistGroups } from '../../../db/repositories/groups'

const inSchema = z.object({ waitlistId: z.string(), groupIds: z.array(z.string()) })

export default defineEventHandler(async (event) => {
  const parsed = inSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  await setWaitlistGroups(parsed.data.waitlistId, parsed.data.groupIds)
  return { ok: true }
})
