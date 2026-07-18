// DELETE /api/v1/dashboard-templates?orgId=&userType= — remove a per-role dashboard
// template (reverts that role to the standard layout).
import { deleteDashboardTemplate } from '../../../db/repositories/admin'

export default defineEventHandler(async (event) => {
  const { orgId, userType } = getQuery(event)
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  if (!userType) throw createError({ statusCode: 400, statusMessage: 'userType is required' })
  await deleteDashboardTemplate(String(orgId), String(userType))
  return { ok: true }
})
