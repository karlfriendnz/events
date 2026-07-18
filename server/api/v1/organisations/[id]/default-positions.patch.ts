// PATCH /api/v1/organisations/:id/default-positions — replace the org-wide default
// member positions. Body { positions: string[] }.
import { setDefaultMemberPositions } from '../../../../db/repositories/organisations'
import { setDefaultMemberPositionsSchema } from '../../../../../shared/contracts/organisation'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { positions } = setDefaultMemberPositionsSchema.parse(await readBody(event))
  await setDefaultMemberPositions(id, positions)
  return { ok: true }
})
