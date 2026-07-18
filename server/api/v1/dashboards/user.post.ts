// POST /api/v1/dashboards/user — upsert a user's dashboard layout (whole-array
// replace, keyed on user+org). Input + output validated against the shared contract.
import { saveUserDashboard } from '../../../db/repositories/dashboards'
import { userDashboardSaveSchema, userDashboardSchema } from '../../../../shared/contracts/dashboard'

export default defineEventHandler(async (event) => {
  const { userId, orgId, config } = userDashboardSaveSchema.parse(await readBody(event))
  const saved = await saveUserDashboard(userId, orgId, config)
  return userDashboardSchema.parse(saved)
})
