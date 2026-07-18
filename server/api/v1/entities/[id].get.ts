// GET /api/v1/entities/:id — one entity record. 404 when it doesn't exist.
import { getEntity } from '../../../db/repositories/circles'
import { entitySchema } from '../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const entity = await getEntity(id)
  if (!entity) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return entitySchema.parse(entity)
})
