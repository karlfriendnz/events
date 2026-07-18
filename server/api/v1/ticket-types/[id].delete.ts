// DELETE /api/v1/ticket-types/:id — remove a ticket type.
import { deleteTicketType } from '../../../db/repositories/events'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteTicketType(id)
  return { ok: true }
})
