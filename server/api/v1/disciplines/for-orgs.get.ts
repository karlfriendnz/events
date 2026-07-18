// GET /api/v1/disciplines/for-orgs?orgIds=a,b,c — every discipline owned by a SET of
// orgs. The requirement engine needs a discipline's whole ancestor chain, and those
// ancestors may belong to different governing bodies. Empty in → empty out.
import { listDisciplinesForOrgs } from '../../../db/repositories/disciplines'
import { disciplineListSchema } from '../../../../shared/contracts/discipline'

export default defineEventHandler(async (event) => {
  const raw = getQuery(event).orgIds
  const orgIds = (typeof raw === 'string' ? raw : '').split(',').map((s) => s.trim()).filter(Boolean)
  return disciplineListSchema.parse(await listDisciplinesForOrgs(orgIds))
})
