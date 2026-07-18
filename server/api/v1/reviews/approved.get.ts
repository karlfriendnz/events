// GET /api/v1/reviews/approved?orgId= — the org's APPROVED page paths.
// Feeds the developer-gate stub's navigable list.
import { listApprovedPaths } from '../../../db/repositories/reviews'
import { approvedPathsSchema } from '../../../../shared/contracts/review'

export default defineEventHandler(async (event) => {
  const { orgId } = getQuery(event)
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId required' })
  return approvedPathsSchema.parse(await listApprovedPaths(String(orgId)))
})
