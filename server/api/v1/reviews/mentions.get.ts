// GET /api/v1/reviews/mentions?orgId=&reviewerId= — every open comment across
// the org that names this reviewer.
//
// Cross-page on purpose: the review panel only ever shows the page you are
// standing on, so a mention left on another screen would otherwise never reach
// the person it was aimed at.
import { listMentionsFor } from '../../../db/repositories/reviews'
import { pageCommentListSchema } from '../../../../shared/contracts/review'

export default defineEventHandler(async (event) => {
  const { orgId, reviewerId } = getQuery(event) as { orgId?: string; reviewerId?: string }
  if (!orgId || !reviewerId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId and reviewerId required' })
  }
  return pageCommentListSchema.parse(await listMentionsFor(orgId, reviewerId))
})
