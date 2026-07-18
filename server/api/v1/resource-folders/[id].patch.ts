// PATCH /api/v1/resource-folders/:id — rename / move / toggle override.
import { updateFolder } from '../../../db/repositories/resources'
import { resourceFolderPatchSchema, resourceFolderSchema } from '../../../../shared/contracts/resource'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = resourceFolderPatchSchema.parse(await readBody(event))
  const updated = await updateFolder(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return resourceFolderSchema.parse(updated)
})
