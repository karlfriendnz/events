// POST /api/v1/custom-reports?orgId= — create a custom report.
import { createCustomReport } from '../../../db/repositories/finances'
import { customReportCreateSchema, customReportSchema } from '../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const input = customReportCreateSchema.parse(await readBody(event))
  return customReportSchema.parse(await createCustomReport(orgId, input))
})
