// GET /api/v1/help-articles — the platform help-documentation catalogue. Global
// master data: NO org scope (content is terminology-tokenised per club at render).
// Output is validated against the shared contract before it leaves.
import { listHelpArticles } from '../../../db/repositories/admin'
import { helpArticleListSchema } from '../../../../shared/contracts/admin'

export default defineEventHandler(async () => {
  const articles = await listHelpArticles()
  return helpArticleListSchema.parse(articles)
})
