// GET /api/v1/org-hierarchy/ancestors?orgId= — the parent_id chain above an org
// (immediate parent first). Replaces the Postgres org_ancestors RPC.
import { orgAncestors } from '../../../db/repositories/admin'
import { orgHierarchyNodeListSchema } from '../../../../shared/contracts/admin'

export default defineEventHandler(async (event) => {
  const orgId = String(getQuery(event).orgId ?? '')
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  const nodes = await orgAncestors(orgId)
  return orgHierarchyNodeListSchema.parse(nodes)
})
