// GET /api/v1/activity-modes/:id/resources — venue ids a coach mode reserves.
import { listActivityModeResources } from '../../../../db/repositories/bookings'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return z.array(z.object({ modeId: z.string(), bookableId: z.string(), sortOrder: z.number() })).parse(await listActivityModeResources(id))
})
