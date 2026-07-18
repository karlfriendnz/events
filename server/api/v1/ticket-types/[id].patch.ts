// PATCH /api/v1/ticket-types/:id — update a ticket type.
import { updateTicketType } from '../../../db/repositories/events'
import { ticketTypePatchSchema, ticketTypeSchema } from '../../../../shared/contracts/event'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = ticketTypePatchSchema.parse(await readBody(event))
  const row = await updateTicketType(id, patch)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return ticketTypeSchema.parse(row)
})
