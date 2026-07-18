// GET /api/v1/organisations/:id/default-positions — the org-wide default member
// positions (Captain/Wing/…). A plain label list.
import { getDefaultMemberPositions } from '../../../../db/repositories/organisations'
import { defaultMemberPositionsSchema } from '../../../../../shared/contracts/organisation'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return defaultMemberPositionsSchema.parse(await getDefaultMemberPositions(id))
})
