// POST /api/v1/groups/:id/schedules-sync — id-preserving save of a group's weekly
// training schedules. Unlike schedules.post.ts (delete-then-insert with fresh ids),
// this UPDATES existing rows in place by id so linked training events stay attached.
// Body = { orgId, rows }; each row's optional id present = update, absent/null = insert.
import { z } from 'zod'
import { syncSchedules } from '../../../../db/repositories/groups'
import { memberGroupScheduleListSchema } from '../../../../../shared/contracts/group'

const rowSchema = z.object({
  id: z.string().nullable().optional(),
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
  const saved = await syncSchedules(parsed.data.orgId, groupId, parsed.data.rows)
  return memberGroupScheduleListSchema.parse(saved)
})
