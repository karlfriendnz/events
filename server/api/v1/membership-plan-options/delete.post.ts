// POST /api/v1/membership-plan-options/delete — bulk-delete a plan's options by id.
// A POST (not DELETE) so the id list + planId travel in the body; planId scopes the
// WHERE (tenant safety — option rows have no org_id).
import { deletePlanOptions } from '../../../db/repositories/memberships'
import { membershipPlanOptionDeleteSchema } from '../../../../shared/contracts/membership'

export default defineEventHandler(async (event) => {
  const { planId, ids } = membershipPlanOptionDeleteSchema.parse(await readBody(event))
  await deletePlanOptions(planId, ids)
  return { ok: true }
})
