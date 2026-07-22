// GET /api/v1/events/:id/coordinators — the event's coordinators (+ their names).
import { listEventCoordinators } from '../../../../db/repositories/events'
import { eventCoordinatorListSchema } from '../../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return eventCoordinatorListSchema.parse(await listEventCoordinators(id))
})
