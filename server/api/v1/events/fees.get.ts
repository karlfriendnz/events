// GET /api/v1/events/fees?eventId=&sessionIds=csv — fee lines for an event and/or a
// set of sessions (session fees are keyed by session_id, NOT event_id). Output
// validated. (cross-domain gap Fo9)
import { listFeeComponents } from '../../../db/repositories/events'
import { feeComponentListSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const { eventId, sessionIds } = getQuery(event)
  const ids = typeof sessionIds === 'string' && sessionIds.length ? sessionIds.split(',') : undefined
  return feeComponentListSchema.parse(
    await listFeeComponents({
      eventId: typeof eventId === 'string' ? eventId : undefined,
      sessionIds: ids,
    }),
  )
})
