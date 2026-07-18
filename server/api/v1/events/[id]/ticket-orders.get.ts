// GET /api/v1/events/:id/ticket-orders — ticket-order registrations for an event
// (registrations with a ticket_id) + their nested ticket line-items with type names.
// Output validated.
import { listTicketOrders } from '../../../../db/repositories/events'
import { ticketOrderListSchema } from '../../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return ticketOrderListSchema.parse(await listTicketOrders(id))
})
