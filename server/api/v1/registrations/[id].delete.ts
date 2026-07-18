// DELETE /api/v1/registrations/:id — remove a registration.
import { deleteRegistration } from '../../../db/repositories/events'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteRegistration(id)
  return { ok: true }
})
