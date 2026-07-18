// POST /api/v1/location-staff — grant a person a role at a site (locationId null =
// club-wide). Validates in against the create contract, returns the created row
// validated against the read contract.
import { createLocationStaff } from '../../../db/repositories/affiliations'
import { locationStaffCreateSchema, locationStaffSchema } from '../../../../shared/contracts/affiliation'

export default defineEventHandler(async (event) => {
  const input = locationStaffCreateSchema.parse(await readBody(event))
  return locationStaffSchema.parse(await createLocationStaff(input))
})
