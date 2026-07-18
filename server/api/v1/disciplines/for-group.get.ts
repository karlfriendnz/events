// GET /api/v1/disciplines/for-group?groupId=… — the disciplines a member group is
// linked to (via member_group_disciplines). Each carries its owning orgId so the
// requirement engine can load that discipline's ancestor chain.
import { listGroupDisciplines } from '../../../db/repositories/disciplines'
import { disciplineListSchema } from '../../../../shared/contracts/discipline'

export default defineEventHandler(async (event) => {
  const groupId = getQuery(event).groupId
  if (typeof groupId !== 'string' || !groupId) throw createError({ statusCode: 400, statusMessage: 'groupId is required' })
  return disciplineListSchema.parse(await listGroupDisciplines(groupId))
})
