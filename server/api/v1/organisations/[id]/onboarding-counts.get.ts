// GET /api/v1/organisations/:id/onboarding-counts — DETECTS which onboarding steps are
// done from real data (presence counts across seven domains + the org name). Returns a
// { stepKey: boolean } map. Cross-domain aggregate; lives with the onboarding state.
import { z } from 'zod'
import { onboardingCounts } from '../../../../db/repositories/organisations'

// The map is a fixed set of boolean flags; keep it permissive (record of booleans) so a
// new step key needs no contract change.
const schema = z.record(z.string(), z.boolean())

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return schema.parse(await onboardingCounts(id))
})
