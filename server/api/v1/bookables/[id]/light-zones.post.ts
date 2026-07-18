// POST /api/v1/bookables/:id/light-zones — set connected light zones. Body =
// { zoneIds: string[] }.
import { setBookableLightZones } from '../../../../db/repositories/bookings'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { zoneIds } = z.object({ zoneIds: z.array(z.string()) }).parse(await readBody(event))
  await setBookableLightZones(id, zoneIds)
  return { ok: true }
})
