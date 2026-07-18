// GET /api/v1/bookables/:id/doors — connected door ids.
import { listBookableDoors } from '../../../../db/repositories/bookings'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return z.array(z.string()).parse(await listBookableDoors(id))
})
