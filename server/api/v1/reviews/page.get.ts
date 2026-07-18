// GET /api/v1/reviews/page?orgId=&path= — the whole per-page review load
// (review row + comments + sign-offs) for <ReviewWidget>.
import { getPageBundle } from '../../../db/repositories/reviews'
import { reviewPageBundleSchema } from '../../../../shared/contracts/review'

export default defineEventHandler(async (event) => {
  const { orgId, path } = getQuery(event)
  if (!orgId || !path) throw createError({ statusCode: 400, statusMessage: 'orgId and path required' })
  return reviewPageBundleSchema.parse(await getPageBundle(String(orgId), String(path)))
})
