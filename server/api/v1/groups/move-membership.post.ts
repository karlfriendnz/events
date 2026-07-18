// POST /api/v1/groups/move-membership — move a person from one group to another
// (insert dest, skip-if-exists, then delete source). Body carries the ids + carried
// role/roles/termId. Used by the team allocator.
import { z } from 'zod'
import { moveMembership } from '../../../db/repositories/groups'

const inSchema = z.object({
  fromGroupId: z.string(),
  toGroupId: z.string(),
  personId: z.string(),
  role: z.string().nullable().optional(),
  roles: z.array(z.string()).optional(),
  termId: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const parsed = inSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid move payload' })
  await moveMembership(parsed.data)
  return { ok: true }
})
