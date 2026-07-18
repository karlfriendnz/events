// GET /api/v1/affiliations/for-club?orgId=… — a club's own affiliations, with the
// governing-body name joined, for its Sports screen. Output validated.
import { listAffiliationsForClub } from '../../../db/repositories/affiliations'
import { orgSportWithNamesListSchema } from '../../../../shared/contracts/affiliation'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (!orgId || typeof orgId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const rows = await listAffiliationsForClub(orgId)
  return orgSportWithNamesListSchema.parse(rows)
})
