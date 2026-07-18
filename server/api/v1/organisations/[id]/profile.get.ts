// GET /api/v1/organisations/:id/profile — the identity/branding/season/contact/
// defaults columns the Settings → General tab reads. Kept off the base organisation
// routes so the identity/tree contract stays lean. Output validated against the
// shared contract before it leaves.
import { getOrgProfile } from '../../../../db/repositories/organisations'
import { orgProfileSchema } from '../../../../../shared/contracts/orgProfile'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const profile = await getOrgProfile(id)
  if (!profile) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return orgProfileSchema.parse(profile)
})
