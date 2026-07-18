// POST /api/v1/reviews/reviewers — create ONE reviewer (the signed-in user
// setting up their own profile).
import { createReviewer } from '../../../db/repositories/reviews'
import { createReviewerInputSchema, pageReviewerSchema } from '../../../../shared/contracts/review'

export default defineEventHandler(async (event) => {
  const { orgId, name, role, color, sortOrder } = createReviewerInputSchema.parse(await readBody(event))
  return pageReviewerSchema.parse(await createReviewer({ orgId, name, role: role ?? null, color: color ?? null, sortOrder }))
})
