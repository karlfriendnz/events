// POST /api/v1/reviews/comments — create a pin / page-level comment / reply.
import { createComment } from '../../../db/repositories/reviews'
import { createCommentInputSchema, pageCommentSchema } from '../../../../shared/contracts/review'

export default defineEventHandler(async (event) => {
  const input = createCommentInputSchema.parse(await readBody(event))
  return pageCommentSchema.parse(await createComment(input))
})
