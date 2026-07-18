// GET /api/v1/attendance/counts?orgId= — per-event distinct-attendee counts across a
// whole org (the reporting rollup). Joins attendance → events to scope by org. Output
// validated.
import { attendedCountsByOrg } from '../../../db/repositories/attendance'
import { attendanceCountListSchema } from '../../../../shared/contracts/attendance'

export default defineEventHandler(async (event) => {
  const { orgId } = getQuery(event)
  if (!orgId || typeof orgId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'orgId required' })
  }
  return attendanceCountListSchema.parse(await attendedCountsByOrg(orgId))
})
