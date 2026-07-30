// PATCH /api/v1/invitees/:id — update an invitee (RSVP status, roles, attendance).
import { updateInvitee } from '../../../db/repositories/events'
import { inviteeSchema } from '../../../../shared/contracts/event'
import { legacySetAttendance } from '../../../utils/legacyBridge'
import { z } from 'zod'

const patchSchema = z.object({
  status: z.string().optional(),
  roles: z.array(z.string()).optional(),
  role: z.string().nullable().optional(),
  attended: z.boolean().optional(),
  signedOut: z.boolean().optional(),
  subGroupId: z.string().nullable().optional(),
  respondedAt: z.string().nullable().optional(),
  personId: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = patchSchema.parse(await readBody(event))
  // A legacy roll writes back to the old platform. Only attendance crosses: it is
  // the one thing that screen changes and the one thing the old API accepts —
  // roles, sub-groups and RSVP have no counterpart, so they are not silently lost,
  // they are refused by not being sent.
  if (id.startsWith('legacy-')) {
    if (patch.attended === undefined) {
      throw createError({ statusCode: 400, statusMessage: 'Only attendance can be changed on an event from the old system.' })
    }
    await legacySetAttendance(id, patch.attended)
    const [, eid, pid] = /^legacy-(\d+)-(\d+)$/.exec(id) ?? []
    return inviteeSchema.parse({
      id, eventId: `legacy-${eid}`, sessionId: null, personId: `legacy-${pid}`,
      status: patch.attended ? 'CONFIRMED' : 'INVITED',
      attended: patch.attended, signedOut: false,
      roles: [], role: null, subGroupId: null,
      invitedAt: null, respondedAt: null, inviteSentAt: null,
      clubOrgId: null, invitedViaGroupId: null,
    })
  }
  const row = await updateInvitee(id, patch)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return inviteeSchema.parse(row)
})
