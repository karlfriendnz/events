// POST /api/v1/org-manager-grants/remove — drop a person as a manager entirely at a
// governing org. Org-scoped in the repo WHERE.
import { removeManagerGrantsForPerson } from '../../../db/repositories/affiliations'
import { orgManagerGrantRemoveSchema } from '../../../../shared/contracts/affiliation'

export default defineEventHandler(async (event) => {
  const { orgId, personId } = orgManagerGrantRemoveSchema.parse(await readBody(event))
  await removeManagerGrantsForPerson(orgId, personId)
  return { ok: true }
})
