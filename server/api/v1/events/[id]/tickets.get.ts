// GET /api/v1/events/:id/tickets — the ticket types for one event, sort order.
import { listTicketTypes } from '../../../../db/repositories/events'
import { ticketTypeListSchema } from '../../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return ticketTypeListSchema.parse(await listTicketTypes(id))
})
