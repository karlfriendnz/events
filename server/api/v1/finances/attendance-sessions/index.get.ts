// GET /api/v1/finances/attendance-sessions?orgId=&from=&to= — group-linked training
// event occurrences whose start_at falls in [from, to). `from`/`to` are ISO instants
// the page computes (local-midnight → +15 days), so the window matches the UI exactly.
import { attendanceSessions } from '../../../../db/repositories/finances'
import { attendanceSessionListSchema } from '../../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const orgId = q.orgId
  const from = q.from
  const to = q.to
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  if (typeof from !== 'string' || typeof to !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'from and to are required' })
  }
  return attendanceSessionListSchema.parse(await attendanceSessions(orgId, from, to))
})
