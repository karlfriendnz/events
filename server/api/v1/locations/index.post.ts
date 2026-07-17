// POST /api/v1/locations — create an operational site.
import { createLocation } from '../../../db/repositories/affiliations'
import { locationCreateSchema, locationSchema } from '../../../../shared/contracts/affiliation'

export default defineEventHandler(async (event) => {
  const input = locationCreateSchema.parse(await readBody(event))
  return locationSchema.parse(await createLocation(input))
})
