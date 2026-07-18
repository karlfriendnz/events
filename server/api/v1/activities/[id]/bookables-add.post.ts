// POST /api/v1/activities/:id/bookables-add — APPEND bookable links to an activity
// without touching its existing ones (create wizards link an existing activity to
// new venues). Body = { bookableIds: string[] }.
import { addActivityBookables } from '../../../../db/repositories/bookings'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { bookableIds } = z.object({ bookableIds: z.array(z.string()) }).parse(await readBody(event))
  await addActivityBookables(id, bookableIds)
  return { ok: true }
})
