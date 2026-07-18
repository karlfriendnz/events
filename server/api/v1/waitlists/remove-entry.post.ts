// POST /api/v1/waitlists/remove-entry — remove a waitlist entry by id. Body = { id }.
import { z } from 'zod'
import { removeWaitlistEntry } from '../../../db/repositories/groups'

const inSchema = z.object({ id: z.string() })

export default defineEventHandler(async (event) => {
  const parsed = inSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  await removeWaitlistEntry(parsed.data.id)
  return { ok: true }
})
