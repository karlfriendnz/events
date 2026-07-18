// GET /api/v1/finances/reporting?orgId= — the /reporting dashboard rollup: events
// (+ category name/color) and the raw invitee status list. The page does its own
// client-side grouping.
import { reportingBundle } from '../../../../db/repositories/finances'
import { reportingBundleSchema } from '../../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  return reportingBundleSchema.parse(await reportingBundle(orgId))
})
