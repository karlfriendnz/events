// GET /api/v1/people/by-ids?ids=csv — a bulk person fetch by id set (e.g. attendance
// visitor names). Empty/absent ids → []. Output validated.
import { getPeopleByIds } from '../../../db/repositories/people'
import { personListSchema } from '../../../../shared/contracts/person'

export default defineEventHandler(async (event) => {
  const ids = getQuery(event).ids
  const list = typeof ids === 'string' && ids.length ? ids.split(',') : []
  return personListSchema.parse(await getPeopleByIds(list))
})
