// POST /api/v1/help-articles — create a help article (/admin/help editor). Global
// master data (no org scope). Validates in against the create contract, returns the
// created article.
import { createHelpArticle } from '../../../db/repositories/admin'
import { helpArticleCreateSchema, helpArticleSchema } from '../../../../shared/contracts/admin'

export default defineEventHandler(async (event) => {
  const input = helpArticleCreateSchema.parse(await readBody(event))
  return helpArticleSchema.parse(await createHelpArticle(input))
})
