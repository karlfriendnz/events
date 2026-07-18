// POST /api/v1/resource-views — log one engagement interaction (open/download/watch).
import { createView } from '../../../db/repositories/resources'
import { resourceViewCreateSchema, resourceViewSchema } from '../../../../shared/contracts/resource'

export default defineEventHandler(async (event) => {
  const input = resourceViewCreateSchema.parse(await readBody(event))
  return resourceViewSchema.parse(await createView(input))
})
