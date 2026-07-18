// DELETE /api/v1/event-tasks/:id — remove a task.
import { deleteEventTask } from '../../../db/repositories/events'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteEventTask(id)
  return { ok: true }
})
