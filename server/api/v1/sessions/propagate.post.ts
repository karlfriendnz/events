// POST /api/v1/sessions/propagate — push a master session's shared fields onto every
// LINKED session (master→linked field inheritance). Scoped to (event, master) in the
// repo WHERE. Body = { masterId, eventId, patch: SessionPatch }.
import { updateSessionsByMaster } from '../../../db/repositories/events'
import { sessionPatchSchema } from '../../../../shared/contracts/event'
import { z } from 'zod'

const bodySchema = z.object({
  masterId: z.string(),
  eventId: z.string(),
  patch: sessionPatchSchema,
})

export default defineEventHandler(async (event) => {
  const { masterId, eventId, patch } = bodySchema.parse(await readBody(event))
  await updateSessionsByMaster(masterId, eventId, patch)
  return { ok: true }
})
