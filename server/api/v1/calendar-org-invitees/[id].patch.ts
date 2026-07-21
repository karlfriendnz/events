// PATCH /api/v1/calendar-org-invitees/:id — the invited club accepts/declines and/or
// sets what it connects (event details, fees, communication).
import { z } from 'zod'
import { respondCalendarOrgInvitee } from '../../../db/repositories/events'
import { calendarOrgInviteeSchema, eventConnectionsSchema } from '../../../../shared/contracts/event'

const bodySchema = z.object({
  status: z.string().optional(),
  connections: eventConnectionsSchema.optional(),
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const body = bodySchema.parse(await readBody(event))
  const row = await respondCalendarOrgInvitee(id, body)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Invitation not found' })
  return calendarOrgInviteeSchema.parse(row)
})
