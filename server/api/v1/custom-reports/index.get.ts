// GET /api/v1/custom-reports?orgId= — every custom report for an org.
import { listCustomReports } from '../../../db/repositories/finances'
import { customReportListSchema } from '../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  return customReportListSchema.parse(await listCustomReports(orgId))
})
