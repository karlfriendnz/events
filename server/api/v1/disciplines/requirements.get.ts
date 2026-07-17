// GET /api/v1/disciplines/requirements?disciplineIds=a,b,c — the requirements for a
// set of disciplines. `disciplineIds` is a comma-separated list; an empty/absent
// list returns an empty array (never an error). Output validated against the
// shared contract before it leaves.
import { listRequirements } from '../../../db/repositories/disciplines'
import { disciplineRequirementListSchema } from '../../../../shared/contracts/discipline'

export default defineEventHandler(async (event) => {
  const raw = getQuery(event).disciplineIds
  const ids = (typeof raw === 'string' ? raw : '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const requirements = await listRequirements(ids)
  return disciplineRequirementListSchema.parse(requirements)
})
