// GET /api/v1/attendance?sessionId=[&sessionIds=csv][&eventIds=csv][&onlyAttended=0] —
// attendance rows. Pass a single sessionId, or sessionIds=csv for a set of sessions, or
// eventIds=csv for EVENT-level rows (training events: event_id set, session_id null).
// Defaults to present-only (attended=true); onlyAttended=0 returns all. Output validated.
import { listBySession, listBySessions, listByEvents } from '../../../db/repositories/attendance'
import { attendanceListSchema } from '../../../../shared/contracts/attendance'

export default defineEventHandler(async (event) => {
  const { sessionId, sessionIds, eventIds, onlyAttended } = getQuery(event)
  const only = onlyAttended !== '0' && onlyAttended !== 'false'
  if (typeof eventIds === 'string' && eventIds.length) {
    return attendanceListSchema.parse(await listByEvents(eventIds.split(','), only))
  }
  if (typeof sessionIds === 'string' && sessionIds.length) {
    return attendanceListSchema.parse(await listBySessions(sessionIds.split(','), only))
  }
  if (typeof sessionId === 'string' && sessionId.length) {
    return attendanceListSchema.parse(await listBySession(sessionId, only))
  }
  throw createError({ statusCode: 400, statusMessage: 'sessionId, sessionIds or eventIds required' })
})
