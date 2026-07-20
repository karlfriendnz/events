// POST /api/v1/event-org-invitees — invite a whole affiliated club to an event.
import { z } from 'zod'
import { createEventOrgInvitee } from '../../../db/repositories/events'
import { eventOrgInviteeSchema } from '../../../../shared/contracts/event'

const bodySchema = z.object({
  eventId: z.string(),
  orgId: z.string(),
  invitedByOrgId: z.string().nullable().optional(),
  status: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const body = bodySchema.parse(await readBody(event))
  return eventOrgInviteeSchema.parse(await createEventOrgInvitee(body))
})
