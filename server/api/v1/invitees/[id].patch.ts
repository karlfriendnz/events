// PATCH /api/v1/invitees/:id — update an invitee (RSVP status, roles, attendance).
import { updateInvitee } from '../../../db/repositories/events'
import { inviteeSchema } from '../../../../shared/contracts/event'
import { z } from 'zod'

const patchSchema = z.object({
  status: z.string().optional(),
  roles: z.array(z.string()).optional(),
  role: z.string().nullable().optional(),
  attended: z.boolean().optional(),
  respondedAt: z.string().nullable().optional(),
  personId: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = patchSchema.parse(await readBody(event))
  const row = await updateInvitee(id, patch)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return inviteeSchema.parse(row)
})
