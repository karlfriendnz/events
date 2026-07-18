// PATCH /api/v1/membership-plan-options/:id — update one plan duration option.
import { updatePlanOption } from '../../../db/repositories/memberships'
import {
  membershipPlanOptionPatchSchema,
  membershipPlanOptionSchema,
} from '../../../../shared/contracts/membership'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = membershipPlanOptionPatchSchema.parse(await readBody(event))
  const updated = await updatePlanOption(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return membershipPlanOptionSchema.parse(updated)
})
