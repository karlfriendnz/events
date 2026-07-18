// PATCH /api/v1/event-tasks/:id — edit a task (toggle done, reassign, etc).
import { updateEventTask } from '../../../db/repositories/events'
import { eventTaskPatchSchema, eventTaskSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = eventTaskPatchSchema.parse(await readBody(event))
  const row = await updateEventTask(id, patch)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return eventTaskSchema.parse(row)
})
