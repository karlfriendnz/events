// DELETE /api/v1/communication-topics/:id?orgId= — delete one of the club's own
// topics. orgId tenant-scopes the WHERE (a core topic is untouchable).
import { deleteTopic } from '../../../db/repositories/communications'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { orgId } = getQuery(event)
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  await deleteTopic(id, String(orgId))
  return { ok: true }
})
