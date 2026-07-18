// POST /api/v1/activities/:id/bookables — set the activity's linked bookables
// (delete-then-insert). Body = { bookableIds: string[] }.
import { setActivityBookables } from '../../../../db/repositories/bookings'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { bookableIds } = z.object({ bookableIds: z.array(z.string()) }).parse(await readBody(event))
  await setActivityBookables(id, bookableIds)
  return { ok: true }
})
