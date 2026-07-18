// GET /api/v1/doors?orgId=... — the org's door catalogue.
import { listDoors } from '../../../db/repositories/bookings'
import { doorListSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  return doorListSchema.parse(await listDoors(orgId))
})
