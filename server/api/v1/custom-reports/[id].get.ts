// GET /api/v1/custom-reports/:id — one custom report, or null.
import { getCustomReport } from '../../../db/repositories/finances'
import { customReportOrNullSchema } from '../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return customReportOrNullSchema.parse(await getCustomReport(id))
})
