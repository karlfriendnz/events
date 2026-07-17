// PATCH /api/v1/person-types/:id — partial update.
import { updatePersonType } from '../../../db/repositories/personTypes'
import { personTypePatchSchema, personTypeSchema } from '../../../../shared/contracts/personType'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = personTypePatchSchema.parse(await readBody(event))
  const updated = await updatePersonType(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return personTypeSchema.parse(updated)
})
