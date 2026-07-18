// PATCH /api/v1/light-zones/:id
import { updateLightZone } from '../../../db/repositories/bookings'
import { lightZonePatchSchema, lightZoneSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const updated = await updateLightZone(id, lightZonePatchSchema.parse(await readBody(event)))
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return lightZoneSchema.parse(updated)
})
