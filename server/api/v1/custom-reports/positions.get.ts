// GET /api/v1/custom-reports/positions?orgId= — distinct member-group positions in
// the org, for the report builder's Position field picker.
import { reportPositions } from '../../../db/repositories/finances'
import { reportPositionsSchema } from '../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  return reportPositionsSchema.parse(await reportPositions(orgId))
})
