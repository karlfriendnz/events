// PATCH /api/v1/locations/:id — partial update.
import { updateLocation } from '../../../db/repositories/affiliations'
import { locationPatchSchema, locationSchema } from '../../../../shared/contracts/affiliation'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = locationPatchSchema.parse(await readBody(event))
  const updated = await updateLocation(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return locationSchema.parse(updated)
})
