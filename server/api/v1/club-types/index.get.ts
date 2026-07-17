// GET /api/v1/club-types — the club-type setup-template catalogue. Global master
// data: NO org scope. Output is validated against the shared contract before it
// leaves, guaranteeing the client's types.
import { listClubTypes } from '../../../db/repositories/admin'
import { clubTypeListSchema } from '../../../../shared/contracts/admin'

export default defineEventHandler(async () => {
  const clubTypes = await listClubTypes()
  return clubTypeListSchema.parse(clubTypes)
})
