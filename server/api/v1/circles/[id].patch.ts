// PATCH /api/v1/circles/:id — update a circle's presentation (name / color / imageUrl).
import { updateCircle } from '../../../db/repositories/circles'
import { circlePatchSchema } from '../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = circlePatchSchema.parse(await readBody(event))
  await updateCircle(id, patch)
  return { ok: true }
})
