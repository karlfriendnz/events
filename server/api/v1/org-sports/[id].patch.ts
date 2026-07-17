// PATCH /api/v1/org-sports/:id — partial update.
import { updateOrgSport } from '../../../db/repositories/affiliations'
import { orgSportPatchSchema, orgSportSchema } from '../../../../shared/contracts/affiliation'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = orgSportPatchSchema.parse(await readBody(event))
  const updated = await updateOrgSport(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return orgSportSchema.parse(updated)
})
