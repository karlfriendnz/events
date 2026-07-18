// DELETE /api/v1/help-articles/:id — delete a help article.
import { deleteHelpArticle } from '../../../db/repositories/admin'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteHelpArticle(id)
  return { ok: true }
})
