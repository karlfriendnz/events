// GET /api/v1/organisations/:id/ancestors — the governing chain above an org.
// Replaces the Postgres org_ancestors RPC (now a recursive CTE in the repository).
import { getAncestors } from '../../../../db/repositories/organisations'
import { orgTreeListSchema } from '../../../../../shared/contracts/organisation'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return orgTreeListSchema.parse(await getAncestors(id))
})
