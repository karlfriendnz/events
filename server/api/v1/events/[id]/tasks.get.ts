// GET /api/v1/events/:id/tasks — the tasks/roles on one event, author order.
import { listEventTasks } from '../../../../db/repositories/events'
import { eventTaskListSchema } from '../../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return eventTaskListSchema.parse(await listEventTasks(id))
})
