// POST /api/v1/light-zones — create a light zone.
import { createLightZone } from '../../../db/repositories/bookings'
import { lightZoneCreateSchema, lightZoneSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const input = lightZoneCreateSchema.parse(await readBody(event))
  return lightZoneSchema.parse(await createLightZone(input))
})
