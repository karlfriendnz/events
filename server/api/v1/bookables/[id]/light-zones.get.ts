// GET /api/v1/bookables/:id/light-zones — connected light-zone ids.
import { listBookableLightZones } from '../../../../db/repositories/bookings'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return z.array(z.string()).parse(await listBookableLightZones(id))
})
