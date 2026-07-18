// POST /api/v1/activity-modes/:id/resources — set the venue pool. Body =
// { bookableIds: string[] }.
import { setActivityModeResources } from '../../../../db/repositories/bookings'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { bookableIds } = z.object({ bookableIds: z.array(z.string()) }).parse(await readBody(event))
  await setActivityModeResources(id, bookableIds)
  return { ok: true }
})
