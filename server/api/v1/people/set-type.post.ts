// POST /api/v1/people/set-type — bulk-set (or clear) the type on N selected people.
// A single scoped UPDATE rather than N round-trips. orgId scopes the write so a
// crafted id from another tenant can't be swept in.
import { z } from 'zod'
import { setTypeForMany } from '../../../db/repositories/people'

const bodySchema = z.object({
  orgId: z.string().min(1),
  ids: z.array(z.string()),
  // null = clear the type.
  typeKey: z.string().nullable(),
})

export default defineEventHandler(async (event) => {
  const { orgId, ids, typeKey } = bodySchema.parse(await readBody(event))
  await setTypeForMany(orgId, ids, typeKey)
  return { ok: true, count: ids.length }
})
