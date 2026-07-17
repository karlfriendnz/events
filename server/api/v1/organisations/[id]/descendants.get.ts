// GET /api/v1/organisations/:id/descendants — every org beneath this one. The
// governing subtree: what an NSO "can talk to". Replaces org_descendants.
import { getDescendants } from '../../../../db/repositories/organisations'
import { orgTreeListSchema } from '../../../../../shared/contracts/organisation'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return orgTreeListSchema.parse(await getDescendants(id))
})
