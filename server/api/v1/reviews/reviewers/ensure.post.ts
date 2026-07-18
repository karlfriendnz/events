// POST /api/v1/reviews/reviewers/ensure — seed the DEFAULT reviewer set for an
// org that has none, then return the resolved list. Idempotent.
import { ensureReviewers } from '../../../../db/repositories/reviews'
import { ensureReviewersInputSchema, pageReviewerListSchema } from '../../../../../shared/contracts/review'

export default defineEventHandler(async (event) => {
  const { orgId, defaults } = ensureReviewersInputSchema.parse(await readBody(event))
  return pageReviewerListSchema.parse(await ensureReviewers(orgId, defaults))
})
