// GET /api/v1/affiliations/for-body?orgId=… — the affiliation register + approval
// queue for a governing body: every request/relationship pointing at it or any org
// beneath it (subtree resolved server-side), club + body names joined, newest first.
// Output validated against the shared contract.
import { listAffiliationsForBody } from '../../../db/repositories/affiliations'
import { orgSportWithNamesListSchema } from '../../../../shared/contracts/affiliation'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (!orgId || typeof orgId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const rows = await listAffiliationsForBody(orgId)
  return orgSportWithNamesListSchema.parse(rows)
})
