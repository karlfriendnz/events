// PATCH /api/v1/organisations/:id/profile — save any subset of the Settings → General
// tab's columns (identity, branding, season, contact, club-level payment/booker
// defaults). Input validated against the shared patch contract; parentId is not
// accepted (privileged re-parenting, CRIT-3). Output validated before it leaves.
import { updateOrgProfile } from '../../../../db/repositories/organisations'
import { orgProfilePatchSchema, orgProfileSchema } from '../../../../../shared/contracts/orgProfile'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = orgProfilePatchSchema.parse(await readBody(event))
  const updated = await updateOrgProfile(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return orgProfileSchema.parse(updated)
})
