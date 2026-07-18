// GET /api/v1/person-types/:id/full — one org type with its full per-type config
// (roster min/max, landing, menu, profile dashboard). Used by a full-fidelity
// duplicate so nothing is dropped. Coexists with the top-level [id].patch/[id].delete.
import { getOrgTypeFull } from '../../../../db/repositories/personTypes'
import { orgTypeFullSchema } from '../../../../../shared/contracts/personType'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const t = await getOrgTypeFull(id)
  if (!t) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return orgTypeFullSchema.parse(t)
})
