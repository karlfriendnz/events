// GET /api/v1/groups/groups-for-persons?personIds=a,b,c — the groups a set of people
// belong to, each edge with the group's id/name/color (the event attendance "group by
// member group" view). Thin projection; parsed on output.
import { z } from 'zod'
import { listGroupsForPersons } from '../../../db/repositories/groups'

const outSchema = z.array(
  z.object({
    personId: z.string(),
    group: z.object({ id: z.string(), name: z.string(), color: z.string().nullable() }),
  }),
)

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const raw = typeof q.personIds === 'string' ? q.personIds : ''
  const personIds = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return outSchema.parse(await listGroupsForPersons(personIds))
})
