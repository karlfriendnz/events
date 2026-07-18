// GET /api/v1/dashboard-templates?orgId= — the per-role club-dashboard default
// templates for an org. The repo function existed with no route; this wires it.
import { listDashboardTemplates } from '../../../db/repositories/admin'
import { dashboardTemplateListSchema } from '../../../../shared/contracts/admin'

export default defineEventHandler(async (event) => {
  const { orgId } = getQuery(event)
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  return dashboardTemplateListSchema.parse(await listDashboardTemplates(String(orgId)))
})
