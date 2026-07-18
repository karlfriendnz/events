// POST /api/v1/people/delete-many — bulk-delete N selected people in one scoped
// statement. orgId scopes the delete so a crafted id from another tenant can't be
// swept in. (POST, not DELETE, so the id list rides in the body.)
import { z } from 'zod'
import { deletePeople } from '../../../db/repositories/people'

const bodySchema = z.object({
  orgId: z.string().min(1),
  ids: z.array(z.string()),
})

export default defineEventHandler(async (event) => {
  const { orgId, ids } = bodySchema.parse(await readBody(event))
  await deletePeople(orgId, ids)
  return { ok: true, count: ids.length }
})
