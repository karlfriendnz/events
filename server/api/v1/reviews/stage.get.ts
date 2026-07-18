// GET /api/v1/reviews/stage?orgId=&path= — just the stage for one page.
// Lean read for useDeveloperGate (no comments/sign-offs needed).
import { getStage } from '../../../db/repositories/reviews'
import { pageStageSchema } from '../../../../shared/contracts/review'

export default defineEventHandler(async (event) => {
  const { orgId, path } = getQuery(event)
  if (!orgId || !path) throw createError({ statusCode: 400, statusMessage: 'orgId and path required' })
  return pageStageSchema.parse({ stage: await getStage(String(orgId), String(path)) })
})
