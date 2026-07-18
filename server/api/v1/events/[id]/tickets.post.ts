// POST /api/v1/events/:id/tickets — create a ticket type on an event.
import { createTicketType } from '../../../../db/repositories/events'
import { ticketTypeCreateSchema, ticketTypeSchema } from '../../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const input = ticketTypeCreateSchema.parse({ ...(await readBody(event)), eventId: id })
  return ticketTypeSchema.parse(await createTicketType(input))
})
