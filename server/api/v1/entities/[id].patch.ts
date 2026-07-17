// PATCH /api/v1/entities/:id — partial update.
import { updateEntity } from '../../../db/repositories/circles'
import { entityPatchSchema, entitySchema } from '../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = entityPatchSchema.parse(await readBody(event))
  const updated = await updateEntity(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return entitySchema.parse(updated)
})
