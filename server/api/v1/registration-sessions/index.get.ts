// GET /api/v1/registration-sessions?sessionIds=csv — registration-session rows for a
// set of sessions (across all registrations), for per-session booking counts.
import { listRegistrationSessionsBySessions } from '../../../db/repositories/events'
import { registrationSessionListSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const { sessionIds } = getQuery(event)
  const ids = typeof sessionIds === 'string' && sessionIds.length ? sessionIds.split(',') : []
  return registrationSessionListSchema.parse(await listRegistrationSessionsBySessions(ids))
})
