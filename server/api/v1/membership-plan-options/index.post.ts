// POST /api/v1/membership-plan-options — create a plan's duration option. Validates in
// against the create contract, returns the created option validated against the read
// contract (parse-on-output).
import { createPlanOption } from '../../../db/repositories/memberships'
import {
  membershipPlanOptionCreateSchema,
  membershipPlanOptionSchema,
} from '../../../../shared/contracts/membership'

export default defineEventHandler(async (event) => {
  const input = membershipPlanOptionCreateSchema.parse(await readBody(event))
  return membershipPlanOptionSchema.parse(await createPlanOption(input))
})
