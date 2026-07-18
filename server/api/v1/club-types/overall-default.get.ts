// GET /api/v1/club-types/overall-default — the id of the platform "Overall
// default" template row, or null. Static route (wins over [id].get.ts).
import { overallDefaultClubTypeId } from '../../../db/repositories/admin'
import { idResultSchema } from '../../../../shared/contracts/admin'

export default defineEventHandler(async () => {
  const id = await overallDefaultClubTypeId()
  return idResultSchema.parse({ id })
})
