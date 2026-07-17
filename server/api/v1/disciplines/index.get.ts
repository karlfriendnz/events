// GET /api/v1/disciplines?orgId=... — every discipline an org defines. The client
// only ever talks to routes like this, never to the database. Output is validated
// against the shared contract before it leaves, so the client's types are
// guaranteed.
import { listDisciplines } from '../../../db/repositories/disciplines'
import { disciplineListSchema } from '../../../../shared/contracts/discipline'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const disciplines = await listDisciplines(orgId)
  // Parse-on-output: the route can never ship a shape the client didn't agree to.
  return disciplineListSchema.parse(disciplines)
})
