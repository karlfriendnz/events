// GET /api/v1/events/:id/sessions — the sessions (occurrences) of one event, in
// author order. Output validated against the shared contract before it leaves.
import { listSessions } from '../../../../db/repositories/events'
import { sessionListSchema } from '../../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return sessionListSchema.parse(await listSessions(id))
})
