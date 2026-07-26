// POST /api/v1/people/:id/override-push — the governing body pushes its private edits
// onto the CLUB's person row (core overwrites, custom fields merge), then clears the
// overlay. Returns the updated person.
import { pushPersonOverride } from '../../../../db/repositories/people'
import { personOverridePushSchema } from '../../../../../shared/contracts/personOverride'
import { personSchema } from '../../../../../shared/contracts/person'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { orgId } = personOverridePushSchema.parse(await readBody(event))
  const updated = await pushPersonOverride(orgId, id)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return personSchema.parse(updated)
})
