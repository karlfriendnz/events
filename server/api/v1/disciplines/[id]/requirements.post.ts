// POST /api/v1/disciplines/:id/requirements — replace the whole requirement set for
// one discipline (delete-then-insert), mirroring the app's saveRequirements. The
// body is the full array of requirement rows; returns the saved set (read contract).
import { saveRequirements } from '../../../../db/repositories/disciplines'
import {
  disciplineRequirementSaveSchema,
  disciplineRequirementListSchema,
} from '../../../../../shared/contracts/discipline'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const rows = disciplineRequirementSaveSchema.parse(await readBody(event))
  return disciplineRequirementListSchema.parse(await saveRequirements(id, rows))
})
