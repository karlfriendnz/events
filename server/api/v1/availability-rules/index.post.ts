// POST /api/v1/availability-rules — create ONE availability rule (the granular,
// id-stable, history-preserving write the availability editor needs; the whole-set
// replaceAvailabilityRules would destroy id stability + the replaced_by history).
import { createAvailabilityRule } from '../../../db/repositories/bookings'
import { availabilityRuleCreateSchema, availabilityRuleSchema } from '../../../../shared/contracts/booking'

export default defineEventHandler(async (event) => {
  const input = availabilityRuleCreateSchema.parse(await readBody(event))
  return availabilityRuleSchema.parse(await createAvailabilityRule(input))
})
