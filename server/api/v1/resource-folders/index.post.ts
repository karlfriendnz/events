// POST /api/v1/resource-folders — create a folder in an org's resource library.
import { createFolder } from '../../../db/repositories/resources'
import { resourceFolderCreateSchema, resourceFolderSchema } from '../../../../shared/contracts/resource'

export default defineEventHandler(async (event) => {
  const input = resourceFolderCreateSchema.parse(await readBody(event))
  return resourceFolderSchema.parse(await createFolder(input))
})
