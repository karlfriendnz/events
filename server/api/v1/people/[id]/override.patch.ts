// PATCH /api/v1/people/:id/override — save a governing body's private edits on this
// club-owned person. Merges onto any existing overlay; never touches the person.
import { upsertPersonOverride } from '../../../../db/repositories/people'
import { personOverridePatchSchema, personOverrideSchema } from '../../../../../shared/contracts/personOverride'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = personOverridePatchSchema.parse(await readBody(event))
  const saved = await upsertPersonOverride(patch.orgId, id, patch)
  return personOverrideSchema.parse(saved)
})
