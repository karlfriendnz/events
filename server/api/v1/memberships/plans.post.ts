// POST /api/v1/memberships/plans — create a membership plan. Validates the body
// against the create contract (parse-on-input), returns the created base plan row
// validated against the read contract (parse-on-output). Coexists with plans.get.ts.
import { createPlan } from '../../../db/repositories/memberships'
import { membershipPlanCreateSchema, membershipPlanSchema } from '../../../../shared/contracts/membership'

export default defineEventHandler(async (event) => {
  const input = membershipPlanCreateSchema.parse(await readBody(event))
  return membershipPlanSchema.parse(await createPlan(input))
})
