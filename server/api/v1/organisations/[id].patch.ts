// PATCH /api/v1/organisations/:id — partial update. Coexists with the [id]/ dir
// (ancestors/descendants) — different route, no conflict.
import { updateOrganisation } from '../../../db/repositories/organisations'
import { organisationPatchSchema, organisationSchema } from '../../../../shared/contracts/organisation'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = organisationPatchSchema.parse(await readBody(event))
  const updated = await updateOrganisation(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return organisationSchema.parse(updated)
})
