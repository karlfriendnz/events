// PATCH /api/v1/organisations/:id/dashboard-banner — set (or clear with null) the
// dashboard hero background image. A focused write, not a general org edit.
import { setDashboardBanner } from '../../../../db/repositories/organisations'
import { dashboardBannerPatchSchema } from '../../../../../shared/contracts/orgDashboard'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { dashboardBannerUrl } = dashboardBannerPatchSchema.parse(await readBody(event))
  await setDashboardBanner(id, dashboardBannerUrl)
  return { ok: true }
})
