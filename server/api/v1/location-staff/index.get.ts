// GET /api/v1/location-staff?orgId=…[&personId=…] — per-site staff assignments. Feeds
// the People directory's location lens (a person "belongs" to a site via a staff row).
// With personId, scopes to ONE person's explicit grants (the access-lens resolver).
// Output validated against the shared affiliation contract before it leaves.
import { listLocationStaff, listLocationStaffByPerson } from '../../../db/repositories/affiliations'
import { locationStaffListSchema } from '../../../../shared/contracts/affiliation'

export default defineEventHandler(async (event) => {
  const { orgId, personId } = getQuery(event)
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const rows = typeof personId === 'string' && personId
    ? await listLocationStaffByPerson(orgId, personId)
    : await listLocationStaff(orgId)
  return locationStaffListSchema.parse(rows)
})
