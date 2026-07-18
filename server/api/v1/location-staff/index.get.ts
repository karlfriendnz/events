// GET /api/v1/location-staff?orgId=… — an org's per-site staff assignments. Feeds the
// People directory's location lens (a person "belongs" to a site via a staff row).
// Output validated against the shared affiliation contract before it leaves.
import { listLocationStaff } from '../../../db/repositories/affiliations'
import { locationStaffListSchema } from '../../../../shared/contracts/affiliation'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const rows = await listLocationStaff(orgId)
  return locationStaffListSchema.parse(rows)
})
