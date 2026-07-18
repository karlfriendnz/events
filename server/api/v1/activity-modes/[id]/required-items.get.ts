// GET /api/v1/activity-modes/:id/required-items — equipment a mode declares.
import { listActivityModeRequiredItems } from '../../../../db/repositories/bookings'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return z.array(z.object({
    id: z.string(), modeId: z.string(), bookableId: z.string(), quantity: z.number(),
    sortOrder: z.number(), isOptional: z.boolean(), priceOverride: z.union([z.string(), z.number()]).nullable(),
  })).parse(await listActivityModeRequiredItems(id))
})
