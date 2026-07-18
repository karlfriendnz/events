// POST /api/v1/bookables/:id/availability — replace the whole rule set for a
// bookable (delete-then-insert). Body = AvailabilityRuleCreate[]. The editor owns
// the whole set for a venue.
import { replaceAvailabilityRules } from '../../../../db/repositories/bookings'
import { availabilityRuleCreateSchema, availabilityRuleListSchema } from '../../../../../shared/contracts/booking'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const rules = z.array(availabilityRuleCreateSchema).parse(await readBody(event))
  return availabilityRuleListSchema.parse(await replaceAvailabilityRules(id, rules))
})
