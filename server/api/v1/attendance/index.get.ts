// GET /api/v1/attendance?sessionId=[&sessionIds=csv][&onlyAttended=0] — per-session
// attendance rows. Pass a single sessionId, or sessionIds=csv for a set. Defaults to
// present-only (attended=true); onlyAttended=0 returns all. Output validated.
import { listBySession, listBySessions } from '../../../db/repositories/attendance'
import { attendanceListSchema } from '../../../../shared/contracts/attendance'

export default defineEventHandler(async (event) => {
  const { sessionId, sessionIds, onlyAttended } = getQuery(event)
  const only = onlyAttended !== '0' && onlyAttended !== 'false'
  if (typeof sessionIds === 'string' && sessionIds.length) {
    return attendanceListSchema.parse(await listBySessions(sessionIds.split(','), only))
  }
  if (typeof sessionId === 'string' && sessionId.length) {
    return attendanceListSchema.parse(await listBySession(sessionId, only))
  }
  throw createError({ statusCode: 400, statusMessage: 'sessionId or sessionIds required' })
})
