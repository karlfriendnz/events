// PATCH /api/v1/club-types/:id — rename a club type. The setup-template payloads
// are saved separately (see defaults.patch.ts).
import { updateClubType } from '../../../db/repositories/admin'
import { clubTypePatchSchema, clubTypeSchema } from '../../../../shared/contracts/admin'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  const patch = clubTypePatchSchema.parse(await readBody(event))
  const clubType = await updateClubType(id, patch)
  if (!clubType) throw createError({ statusCode: 404, statusMessage: 'Club type not found' })
  return clubTypeSchema.parse(clubType)
})
