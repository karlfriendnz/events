// GET /api/v1/circles?personId=... — every circle a person belongs to. The client
// only ever talks to routes like this, never to the database. Output is validated
// against the shared contract before it leaves, so the client's types are guaranteed.
import { listCirclesForPerson } from '../../../db/repositories/circles'
import { circleListSchema } from '../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const personId = getQuery(event).personId
  if (typeof personId !== 'string' || !personId) {
    throw createError({ statusCode: 400, statusMessage: 'personId is required' })
  }
  const circles = await listCirclesForPerson(personId)
  return circleListSchema.parse(circles)
})
