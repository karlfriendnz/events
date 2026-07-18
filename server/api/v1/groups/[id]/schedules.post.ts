// POST /api/v1/groups/:id/schedules — replace a group's weekly training schedules
// (delete-then-insert). Body = { orgId, rows }. Returns the saved schedules.
import { z } from 'zod'
import { saveSchedules } from '../../../../db/repositories/groups'
import { memberGroupScheduleListSchema } from '../../../../../shared/contracts/group'

const rowSchema = z.object({
  name: z.string().nullable().optional(),
  dayOfWeek: z.number().int(),
  startTime: z.string(),
  endTime: z.string(),
  location: z.any().optional(),
  sortOrder: z.number().int().nullable().optional(),
})
const inSchema = z.object({ orgId: z.string(), rows: z.array(rowSchema) })

export default defineEventHandler(async (event) => {
  const groupId = getRouterParam(event, 'id')!
  const parsed = inSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid schedules payload' })
  const saved = await saveSchedules(parsed.data.orgId, groupId, parsed.data.rows)
  return memberGroupScheduleListSchema.parse(saved)
})
