// GET /api/v1/org-hierarchy/governing?orgId= — every governing body above an org:
// the parent_id chain UNION each APPROVED sport affiliation's chain (deduped, parent
// chain wins). Replaces org_ancestors ∪ org_sport_ancestors — load-bearing for
// multi-sport clubs (see useOrgHierarchy).
import { orgGoverning } from '../../../db/repositories/admin'
import { orgHierarchyNodeListSchema } from '../../../../shared/contracts/admin'

export default defineEventHandler(async (event) => {
  const orgId = String(getQuery(event).orgId ?? '')
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  const nodes = await orgGoverning(orgId)
  return orgHierarchyNodeListSchema.parse(nodes)
})
