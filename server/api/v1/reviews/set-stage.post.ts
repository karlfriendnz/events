// POST /api/v1/reviews/set-stage — upsert the review stage for one page.
import { setStage } from '../../../db/repositories/reviews'
import { setStageInputSchema, pageReviewSchema } from '../../../../shared/contracts/review'

export default defineEventHandler(async (event) => {
  const { orgId, path, stage, approvedById } = setStageInputSchema.parse(await readBody(event))
  return pageReviewSchema.parse(await setStage(orgId, path, stage, approvedById ?? null))
})
