// PATCH /api/v1/help-articles/:id — update a help article.
import { updateHelpArticle } from '../../../db/repositories/admin'
import { helpArticlePatchSchema, helpArticleSchema } from '../../../../shared/contracts/admin'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = helpArticlePatchSchema.parse(await readBody(event))
  const updated = await updateHelpArticle(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return helpArticleSchema.parse(updated)
})
