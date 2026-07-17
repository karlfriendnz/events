// PATCH /api/v1/terms/:id — partial update.
import { updateTerm } from '../../../db/repositories/memberships'
import { orgTermPatchSchema, orgTermSchema } from '../../../../shared/contracts/membership'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = orgTermPatchSchema.parse(await readBody(event))
  const updated = await updateTerm(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return orgTermSchema.parse(updated)
})
