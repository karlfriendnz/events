// GET /api/v1/events/:id/sessions — the sessions (occurrences) of one event, in
// author order. Optional filters: ?masters=1 → only top-level sessions (no parent);
// ?parentSessionId=<id> → only that parent's sub-sessions. Default = every session
// (the editor splits masters vs sub-sessions in JS). Output validated.
import { listSessions } from '../../../../db/repositories/events'
import { sessionListSchema } from '../../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { masters, parentSessionId } = getQuery(event)
  return sessionListSchema.parse(
    await listSessions(id, {
      masters: masters === '1' || masters === 'true',
      parentSessionId: typeof parentSessionId === 'string' ? parentSessionId : undefined,
    }),
  )
})
