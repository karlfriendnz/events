// PATCH /api/v1/organisations/:id/onboarding — save the onboarding checklist state.
// Body { dismissed?, completed_at? }.
import { setOnboarding } from '../../../../db/repositories/organisations'
import { onboardingStateSchema } from '../../../../../shared/contracts/organisation'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const state = onboardingStateSchema.parse(await readBody(event))
  await setOnboarding(id, state)
  return { ok: true }
})
