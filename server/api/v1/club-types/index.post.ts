// POST /api/v1/club-types — create a club type (super-admin Master). Global.
import { createClubType } from '../../../db/repositories/admin'
import { clubTypeCreateSchema, clubTypeSchema } from '../../../../shared/contracts/admin'

export default defineEventHandler(async (event) => {
  const input = clubTypeCreateSchema.parse(await readBody(event))
  const clubType = await createClubType(input)
  return clubTypeSchema.parse(clubType)
})
