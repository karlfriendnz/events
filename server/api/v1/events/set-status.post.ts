// POST /api/v1/events/set-status — bulk-set the status of a set of events (series
// archive: this/following/all). Org-scoped in the WHERE (tenant safety) — the id list
// alone is never trusted. Body = { orgId, ids, status }.
import { setEventsStatus } from '../../../db/repositories/events'
import { z } from 'zod'

const bodySchema = z.object({
  orgId: z.string(),
  ids: z.array(z.string()),
  status: z.string(),
})

export default defineEventHandler(async (event) => {
  const { orgId, ids, status } = bodySchema.parse(await readBody(event))
  await setEventsStatus(orgId, ids, status)
  return { ok: true }
})
