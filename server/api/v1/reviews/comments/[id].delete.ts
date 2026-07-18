// DELETE /api/v1/reviews/comments/:id — hard-delete a comment + its replies.
import { deleteCommentCascade } from '../../../../db/repositories/reviews'
import { okSchema } from '../../../../../shared/contracts/review'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteCommentCascade(id)
  return okSchema.parse({ ok: true })
})
