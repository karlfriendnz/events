// GET /api/v1/bookables/:id/availability — a bookable's availability rules.
import { listAvailabilityRules } from '../../../../db/repositories/bookings'
import { availabilityRuleListSchema } from '../../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return availabilityRuleListSchema.parse(await listAvailabilityRules(id))
})
