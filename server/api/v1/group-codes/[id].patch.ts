// PATCH /api/v1/group-codes/:id — partial update.
import { updateCode } from '../../../db/repositories/groups'
import { groupCodePatchSchema, groupCodeSchema } from '../../../../shared/contracts/group'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = groupCodePatchSchema.parse(await readBody(event))
  const updated = await updateCode(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return groupCodeSchema.parse(updated)
})
