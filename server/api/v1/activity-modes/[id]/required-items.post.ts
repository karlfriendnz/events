// POST /api/v1/activity-modes/:id/required-items — set the equipment list
// (delete-then-insert). Body = { items: [{ bookableId, quantity, sortOrder,
// isOptional, priceOverride? }] }.
import { setActivityModeRequiredItems } from '../../../../db/repositories/bookings'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { items } = z.object({ items: z.array(z.object({
    bookableId: z.string(),
    quantity: z.number().int().optional(),
    sortOrder: z.number().int().optional(),
    isOptional: z.boolean().optional(),
    priceOverride: z.union([z.string(), z.number()]).nullable().optional(),
  })) }).parse(await readBody(event))
  await setActivityModeRequiredItems(id, items.map((it, i) => ({
    bookableId: it.bookableId, quantity: it.quantity ?? 1, sortOrder: it.sortOrder ?? i,
    isOptional: it.isOptional ?? false, priceOverride: it.priceOverride ?? null,
  })))
  return { ok: true }
})
