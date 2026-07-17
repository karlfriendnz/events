// PATCH /api/v1/disciplines/:id — partial update.
import { updateDiscipline } from '../../../db/repositories/disciplines'
import { disciplinePatchSchema, disciplineSchema } from '../../../../shared/contracts/discipline'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = disciplinePatchSchema.parse(await readBody(event))
  const updated = await updateDiscipline(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return disciplineSchema.parse(updated)
})
