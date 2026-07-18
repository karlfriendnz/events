// POST /api/v1/events/:id/tasks — add a task/role to an event.
import { createEventTask } from '../../../../db/repositories/events'
import { eventTaskCreateSchema, eventTaskSchema } from '../../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const body = await readBody(event)
  const input = eventTaskCreateSchema.parse({ ...body, eventId: id })
  return eventTaskSchema.parse(await createEventTask(input))
})
