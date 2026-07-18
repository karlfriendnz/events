// POST /api/v1/activity-modes/:id/bookables — set a mode's bookable scope. Body =
// { rows: [{ bookableId, priceOverride? }] } (modeId inferred from the path).
import { setActivityModeBookables } from '../../../../db/repositories/bookings'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { rows } = z.object({ rows: z.array(z.object({ bookableId: z.string(), priceOverride: z.union([z.string(), z.number()]).nullable().optional() })) }).parse(await readBody(event))
  await setActivityModeBookables(id, rows.map((r) => ({ modeId: id, bookableId: r.bookableId, priceOverride: r.priceOverride ?? null })))
  return { ok: true }
})
