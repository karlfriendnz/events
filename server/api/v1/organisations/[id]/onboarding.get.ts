// GET /api/v1/organisations/:id/onboarding — the new-club onboarding checklist state
// (dismissed / completed_at). {} when never saved.
import { getOnboarding } from '../../../../db/repositories/organisations'
import { onboardingStateSchema } from '../../../../../shared/contracts/organisation'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return onboardingStateSchema.parse(await getOnboarding(id))
})
