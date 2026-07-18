// POST /api/v1/events/:id/invitees — invite a person to an event.
import { createInvitee } from '../../../../db/repositories/events'
import { inviteeSchema } from '../../../../../shared/contracts/event'
import { z } from 'zod'

const bodySchema = z.object({
  personId: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
  status: z.string().optional(),
  roles: z.array(z.string()).optional(),
  role: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const body = bodySchema.parse(await readBody(event))
  return inviteeSchema.parse(await createInvitee({ eventId: id, ...body }))
})
