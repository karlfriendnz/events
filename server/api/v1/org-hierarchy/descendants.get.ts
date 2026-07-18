// GET /api/v1/org-hierarchy/descendants?orgId= — the subtree beneath an org (direct
// children first). Replaces the Postgres org_descendants RPC.
import { orgDescendants } from '../../../db/repositories/admin'
import { orgHierarchyNodeListSchema } from '../../../../shared/contracts/admin'

export default defineEventHandler(async (event) => {
  const orgId = String(getQuery(event).orgId ?? '')
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  const nodes = await orgDescendants(orgId)
  return orgHierarchyNodeListSchema.parse(nodes)
})
