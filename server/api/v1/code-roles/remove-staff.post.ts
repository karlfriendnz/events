// POST /api/v1/code-roles/remove-staff — remove a code-staff assignment by id.
// Body = { id }.
import { z } from 'zod'
import { removeCodeStaff } from '../../../db/repositories/groups'

const inSchema = z.object({ id: z.string() })

export default defineEventHandler(async (event) => {
  const parsed = inSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  await removeCodeStaff(parsed.data.id)
  return { ok: true }
})
