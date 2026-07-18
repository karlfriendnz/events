// POST /api/v1/waitlists/reorder-entries — persist a re-ordered queue (sort_order =
// index). Body = { ids }.
import { z } from 'zod'
import { reorderWaitlistEntries } from '../../../db/repositories/groups'

const inSchema = z.object({ ids: z.array(z.string()) })

export default defineEventHandler(async (event) => {
  const parsed = inSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  await reorderWaitlistEntries(parsed.data.ids)
  return { ok: true }
})
