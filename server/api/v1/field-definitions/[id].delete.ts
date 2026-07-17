// DELETE /api/v1/field-definitions/:id
import { deleteFieldDefinition } from '../../../db/repositories/personTypes'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteFieldDefinition(id)
  return { ok: true }
})
