// GET /api/v1/groups/schedules?groupIds=a,b,c — weekly training schedules across many
// groups (Week View / class finder). Per-group schedules live at /groups/:id/schedules.
import { listSchedulesForGroups } from '../../../db/repositories/groups'
import { memberGroupScheduleListSchema } from '../../../../shared/contracts/group'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const ids = typeof q.groupIds === 'string' && q.groupIds ? q.groupIds.split(',').filter(Boolean) : []
  return memberGroupScheduleListSchema.parse(await listSchedulesForGroups(ids))
})
