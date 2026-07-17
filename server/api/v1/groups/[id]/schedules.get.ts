// GET /api/v1/groups/:id/schedules — the weekly training schedules of one group.
// Output validated against the shared contract before it leaves.
import { listSchedules } from '../../../../db/repositories/groups'
import { memberGroupScheduleListSchema } from '../../../../../shared/contracts/group'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const schedules = await listSchedules(id)
  return memberGroupScheduleListSchema.parse(schedules)
})
