// POST /api/v1/registrations/:id/sessions — add a session selection to a registration.
import { createRegistrationSession } from '../../../../db/repositories/events'
import { registrationSessionSchema } from '../../../../../shared/contracts/event'
import { z } from 'zod'

const bodySchema = z.object({ sessionId: z.string(), status: z.string().optional() })

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { sessionId, status } = bodySchema.parse(await readBody(event))
  return registrationSessionSchema.parse(
    await createRegistrationSession({ registrationId: id, sessionId, status }),
  )
})
