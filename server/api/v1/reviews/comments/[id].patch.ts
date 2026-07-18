// PATCH /api/v1/reviews/comments/:id — resolve / reopen a comment.
import { setCommentResolved } from '../../../../db/repositories/reviews'
import { setCommentResolvedInputSchema, pageCommentSchema } from '../../../../../shared/contracts/review'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { resolved, resolvedById } = setCommentResolvedInputSchema.parse(await readBody(event))
  const updated = await setCommentResolved(id, resolved, resolvedById ?? null)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return pageCommentSchema.parse(updated)
})
