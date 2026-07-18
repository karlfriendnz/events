// PATCH /api/v1/location-staff/:id — change the role or sport-scope of a staff grant.
import { updateLocationStaff } from '../../../db/repositories/affiliations'
import { locationStaffPatchSchema, locationStaffSchema } from '../../../../shared/contracts/affiliation'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = locationStaffPatchSchema.parse(await readBody(event))
  const updated = await updateLocationStaff(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return locationStaffSchema.parse(updated)
})
