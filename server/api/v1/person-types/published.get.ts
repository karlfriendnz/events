// GET /api/v1/person-types/published?orgIds=a,b,c — the PUBLISHED types of a set of
// governing orgs (the only types a club may link its own type to). The client passes
// the governing org ids.
import { listPublishedTypesForOrgs } from '../../../db/repositories/personTypes'
import { linkableTypeListSchema } from '../../../../shared/contracts/personType'

export default defineEventHandler(async (event) => {
  const raw = getQuery(event).orgIds
  const orgIds = (typeof raw === 'string' ? raw : '').split(',').map((s) => s.trim()).filter(Boolean)
  return linkableTypeListSchema.parse(await listPublishedTypesForOrgs(orgIds))
})
