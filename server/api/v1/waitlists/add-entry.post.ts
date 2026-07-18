// POST /api/v1/waitlists/add-entry — add a person to a waitlist queue. Body =
// { orgId, waitlistId, personId, sortOrder?, notes? }. A duplicate (same person on the
// same waitlist) surfaces as a 409 the composable turns into { ok:false }.
import { z } from 'zod'
import { addWaitlistEntry } from '../../../db/repositories/groups'

const inSchema = z.object({
  orgId: z.string(),
  waitlistId: z.string(),
  personId: z.string(),
  sortOrder: z.number().int().optional(),
  notes: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const parsed = inSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  const { orgId, waitlistId, personId, sortOrder, notes } = parsed.data
  await addWaitlistEntry(orgId, waitlistId, personId, sortOrder ?? 0, notes ?? null)
  return { ok: true }
})
