// GET /api/v1/light-zones?orgId=... — the org's light-zone catalogue.
import { listLightZones } from '../../../db/repositories/bookings'
import { lightZoneListSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  return lightZoneListSchema.parse(await listLightZones(orgId))
})
