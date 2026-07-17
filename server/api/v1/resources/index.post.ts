// POST /api/v1/resources — create a resource (file / link / video / …).
import { createResource } from '../../../db/repositories/resources'
import { resourceCreateSchema, resourceSchema } from '../../../../shared/contracts/resource'

export default defineEventHandler(async (event) => {
  const input = resourceCreateSchema.parse(await readBody(event))
  return resourceSchema.parse(await createResource(input))
})
