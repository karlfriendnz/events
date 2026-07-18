// POST /api/v1/waitlists/enrol — enrol a waitlisted person INTO a group and take them
// off the queue (insert the membership skip-if-exists, then delete the entry).
// Body = { entryId, groupId, personId, positions? }.
import { z } from 'zod'
import { enrolFromWaitlist } from '../../../db/repositories/groups'

const inSchema = z.object({
  entryId: z.string(),
  groupId: z.string(),
  personId: z.string(),
  positions: z.array(z.string()).optional(),
})

export default defineEventHandler(async (event) => {
  const parsed = inSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  const { entryId, groupId, personId, positions } = parsed.data
  await enrolFromWaitlist(entryId, groupId, personId, positions ?? [])
  return { ok: true }
})
