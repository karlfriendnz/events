// POST /api/v1/bookables/:id/doors — set connected doors (delete-then-insert).
// Body = { doorIds: string[] }.
import { setBookableDoors } from '../../../../db/repositories/bookings'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { doorIds } = z.object({ doorIds: z.array(z.string()) }).parse(await readBody(event))
  await setBookableDoors(id, doorIds)
  return { ok: true }
})
