// GET /api/v1/events/:id/coordinators — the event's coordinators (+ their names).
import { listEventCoordinators } from '../../../../db/repositories/events'
import { eventCoordinatorListSchema } from '../../../../../shared/contracts/event'
import { isLegacyId, legacyCoordinators } from '../../../../utils/legacyBridge'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  // An event over there has one coordinator on its own form — returned as a list
  // of one, so the summary card renders it the same way as ours.
  if (isLegacyId(id)) return eventCoordinatorListSchema.parse(await legacyCoordinators(id))
  return eventCoordinatorListSchema.parse(await listEventCoordinators(id))
})
