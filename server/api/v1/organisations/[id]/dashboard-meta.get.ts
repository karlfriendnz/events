// GET /api/v1/organisations/:id/dashboard-meta — the org columns the club dashboard
// + member profile screens read (name/logo, hero banner, club-default dashboard +
// profile-dashboard configs, level). Kept off the base organisation routes so the
// identity/tree contract stays lean. Output validated against the shared contract.
import { getOrgDashboardMeta } from '../../../../db/repositories/organisations'
import { orgDashboardMetaSchema } from '../../../../../shared/contracts/orgDashboard'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const meta = await getOrgDashboardMeta(id)
  if (!meta) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return orgDashboardMetaSchema.parse(meta)
})
