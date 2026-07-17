// PATCH /api/v1/resources/:id — partial update.
import { updateResource } from '../../../db/repositories/resources'
import { resourcePatchSchema, resourceSchema } from '../../../../shared/contracts/resource'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = resourcePatchSchema.parse(await readBody(event))
  const updated = await updateResource(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return resourceSchema.parse(updated)
})
