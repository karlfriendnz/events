// POST /api/v1/waitlists/update-entry — patch a waitlist entry (status/notes/sortOrder/
// priority). Body = { id, patch }.
import { z } from 'zod'
import { updateWaitlistEntry } from '../../../db/repositories/groups'

const inSchema = z.object({
  id: z.string(),
  patch: z.object({
    status: z.string().optional(),
    notes: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    priority: z.number().int().optional(),
  }),
})

export default defineEventHandler(async (event) => {
  const parsed = inSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  await updateWaitlistEntry(parsed.data.id, parsed.data.patch)
  return { ok: true }
})
