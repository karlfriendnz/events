// POST /api/v1/events/:id/coordinators — add a coordinator (a person + their notifications).
import { addEventCoordinator } from '../../../../db/repositories/events'
import { eventCoordinatorSchema } from '../../../../../shared/contracts/event'
import { z } from 'zod'

const bodySchema = z.object({ personId: z.string(), notifications: z.array(z.string()).optional() })

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const body = bodySchema.parse(await readBody(event))
  return eventCoordinatorSchema.parse(await addEventCoordinator(id, body.personId, body.notifications ?? []))
})
