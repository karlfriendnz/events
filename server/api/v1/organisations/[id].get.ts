// GET /api/v1/organisations/:id — a single organisation (identity/tree slice).
// Coexists with the [id]/ dir and the [id].patch/[id].delete routes.
import { getOrganisation } from '../../../db/repositories/organisations'
import { organisationSchema } from '../../../../shared/contracts/organisation'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const org = await getOrganisation(id)
  if (!org) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return organisationSchema.parse(org)
})
