// GET /api/v1/activities/:id/bookables — the activity↔bookable links.
import { listActivityBookables } from '../../../../db/repositories/bookings'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return z.array(z.object({ id: z.string(), activityId: z.string(), bookableId: z.string() })).parse(await listActivityBookables(id))
})
