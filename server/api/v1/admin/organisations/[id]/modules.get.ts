// GET /api/v1/admin/organisations/:id/modules — a club's enabled_modules (null =
// all on, or an explicit key list). Drives useOrgModules.
import { getOrgModules } from '../../../../../db/repositories/admin'
import { orgModulesSchema } from '../../../../../../shared/contracts/admin'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  const enabledModules = await getOrgModules(id)
  return orgModulesSchema.parse({ enabledModules })
})
