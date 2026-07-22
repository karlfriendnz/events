// PATCH /api/v1/coordinators/:id — update which notifications a coordinator receives.
import { updateEventCoordinator } from '../../../db/repositories/events'
import { eventCoordinatorSchema } from '../../../../shared/contracts/event'
import { z } from 'zod'

const patchSchema = z.object({ notifications: z.array(z.string()) })

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const body = patchSchema.parse(await readBody(event))
  const updated = await updateEventCoordinator(id, body.notifications)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return eventCoordinatorSchema.parse(updated)
})
