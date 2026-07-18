// GET /api/v1/organisations/:id/settings — the handful of org settings the People
// directory needs (level, member-pull mode, per-tab column selection). Kept off the
// base organisation routes so the identity/tree contract stays lean. Output validated
// against the shared contract before it leaves.
import { getOrgSettings } from '../../../../db/repositories/organisations'
import { orgSettingsSchema } from '../../../../../shared/contracts/orgSettings'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const settings = await getOrgSettings(id)
  if (!settings) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return orgSettingsSchema.parse(settings)
})
