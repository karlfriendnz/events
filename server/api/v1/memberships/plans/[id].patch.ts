// PATCH /api/v1/memberships/plans/:id — partial update. The plans/ dir coexists with
// the plans.post.ts / plans.get.ts files (method + nesting, no route conflict).
import { updatePlan } from '../../../../db/repositories/memberships'
import { membershipPlanPatchSchema, membershipPlanSchema } from '../../../../../shared/contracts/membership'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = membershipPlanPatchSchema.parse(await readBody(event))
  const updated = await updatePlan(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return membershipPlanSchema.parse(updated)
})
