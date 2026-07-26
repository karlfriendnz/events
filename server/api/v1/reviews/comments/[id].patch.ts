// PATCH /api/v1/reviews/comments/:id — partial update of one comment:
// resolve / reopen, edit the body, or record the Claude hand-back. Only the
// fields present in the body are written.
import { patchComment } from '../../../../db/repositories/reviews'
import { patchCommentInputSchema, pageCommentSchema } from '../../../../../shared/contracts/review'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const input = patchCommentInputSchema.parse(await readBody(event))
  const updated = await patchComment(id, input)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return pageCommentSchema.parse(updated)
})
