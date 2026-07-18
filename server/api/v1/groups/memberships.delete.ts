// DELETE /api/v1/groups/memberships — remove one person from a group (body carries
// groupId + personId; the pk). Used by the roster remove + profile syncGroups diff.
import { z } from 'zod'
import { deleteMembership } from '../../../db/repositories/groups'

const inSchema = z.object({ groupId: z.string(), personId: z.string() })

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = inSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'groupId and personId are required' })
  }
  await deleteMembership(parsed.data.groupId, parsed.data.personId)
  return { ok: true }
})
