// GET /api/v1/reviews/reviewers?orgId= — the org's named reviewers, in order.
import { listReviewers } from '../../../db/repositories/reviews'
import { pageReviewerListSchema } from '../../../../shared/contracts/review'

export default defineEventHandler(async (event) => {
  const { orgId } = getQuery(event)
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId required' })
  return pageReviewerListSchema.parse(await listReviewers(String(orgId)))
})
