// GET /api/v1/dashboards/user?userId=...&orgId=... — one user's saved dashboard
// layout for an org (user_dashboards). Returns null config (200) when they've never
// customised — the page then falls back to a template / club default. Output validated.
import { getUserDashboard } from '../../../db/repositories/dashboards'
import { userDashboardSchema } from '../../../../shared/contracts/dashboard'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const userId = query.userId ? String(query.userId) : ''
  const orgId = query.orgId ? String(query.orgId) : ''
  if (!userId || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'userId and orgId are required' })
  }
  const row = await getUserDashboard(userId, orgId)
  // A "no row" answer is legitimate (user never saved) — return an empty-config
  // shape rather than 404 so the client's fallback resolution is a plain null check.
  return userDashboardSchema.parse(row ?? { userId, orgId, config: null })
})
