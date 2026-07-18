// PATCH /api/v1/registrations/:id — update a registration (status, amounts, check-in).
import { updateRegistration } from '../../../db/repositories/events'
import { registrationPatchSchema, registrationSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = registrationPatchSchema.parse(await readBody(event))
  const row = await updateRegistration(id, patch)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return registrationSchema.parse(row)
})
