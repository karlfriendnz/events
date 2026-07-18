// GET /api/v1/activity-modes/:id/bookables — a mode's bookable scope (+ overrides).
import { listActivityModeBookables } from '../../../../db/repositories/bookings'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return z.array(z.object({ modeId: z.string(), bookableId: z.string(), priceOverride: z.union([z.string(), z.number()]).nullable() })).parse(await listActivityModeBookables(id))
})
