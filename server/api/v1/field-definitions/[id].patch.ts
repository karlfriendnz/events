// PATCH /api/v1/field-definitions/:id — partial update.
import { updateFieldDefinition } from '../../../db/repositories/personTypes'
import { fieldDefinitionPatchSchema, fieldDefinitionSchema } from '../../../../shared/contracts/personType'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = fieldDefinitionPatchSchema.parse(await readBody(event))
  const updated = await updateFieldDefinition(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return fieldDefinitionSchema.parse(updated)
})
