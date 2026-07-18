// GET /api/v1/disciplines/for-event?eventId=… — the disciplines an event is linked
// to (via event_disciplines). Each carries its owning orgId so the requirement
// engine can load that discipline's ancestor chain.
import { listEventDisciplines } from '../../../db/repositories/disciplines'
import { disciplineListSchema } from '../../../../shared/contracts/discipline'

export default defineEventHandler(async (event) => {
  const eventId = getQuery(event).eventId
  if (typeof eventId !== 'string' || !eventId) throw createError({ statusCode: 400, statusMessage: 'eventId is required' })
  return disciplineListSchema.parse(await listEventDisciplines(eventId))
})
