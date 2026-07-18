// GET /api/v1/terminology?orgIds=a,b,c — terminology overrides for a set of orgs
// (the client passes org + ancestors; it merges them furthest-first). One row per org.
import { getTerminologyForOrgs } from '../../../db/repositories/personTypes'
import { orgTerminologyListSchema } from '../../../../shared/contracts/personType'

export default defineEventHandler(async (event) => {
  const raw = getQuery(event).orgIds
  const orgIds = (typeof raw === 'string' ? raw : '').split(',').map((s) => s.trim()).filter(Boolean)
  return orgTerminologyListSchema.parse(await getTerminologyForOrgs(orgIds))
})
