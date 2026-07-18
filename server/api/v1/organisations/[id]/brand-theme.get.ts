// GET /api/v1/organisations/:id/brand-theme — the resolved brand colour (via
// brand_id → brands.color) + the org level, for the runtime theme composable to apply
// or fall back to the governing-body blue. One call, no admin round-trip.
import { getOrgBrandTheme } from '../../../../db/repositories/organisations'
import { orgBrandThemeSchema } from '../../../../../shared/contracts/organisation'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const theme = await getOrgBrandTheme(id)
  if (!theme) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return orgBrandThemeSchema.parse(theme)
})
