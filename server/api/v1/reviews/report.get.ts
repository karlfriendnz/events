// GET /api/v1/reviews/report?orgId= — the org-wide sign-off report
// (reviewers + per-page stages, open-comment counts, sign-offs) for pages/dev/review.
import { getReviewReport } from '../../../db/repositories/reviews'
import { reviewReportSchema } from '../../../../shared/contracts/review'

export default defineEventHandler(async (event) => {
  const { orgId } = getQuery(event)
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId required' })
  return reviewReportSchema.parse(await getReviewReport(String(orgId)))
})
