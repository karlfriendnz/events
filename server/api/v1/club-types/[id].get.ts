// GET /api/v1/club-types/:id — one club type incl. its setup-template defaults
// (name / is-overall-default / default modules, person types, terminology).
import { getClubType } from '../../../db/repositories/admin'
import { clubTypeSchema } from '../../../../shared/contracts/admin'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  const clubType = await getClubType(id)
  if (!clubType) throw createError({ statusCode: 404, statusMessage: 'Club type not found' })
  return clubTypeSchema.parse(clubType)
})
