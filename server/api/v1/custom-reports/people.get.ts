// GET /api/v1/custom-reports/people?orgId= — the people a custom report filters over,
// in the snake_case field vocabulary the pure filter engine (useCustomReports) applies,
// each with their union of member-group positions (`__positions`).
import { reportPeople } from '../../../db/repositories/finances'
import { reportPersonListSchema } from '../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  return reportPersonListSchema.parse(await reportPeople(orgId))
})
