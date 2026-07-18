// GET /api/v1/org-sports/governing-bodies?excludeOrgId=… — the governing-body picker
// options for a club's Sports editor: every org except the club itself, carrying
// default_sport_name so choosing a body seeds the canonical sport. The editor filters
// to governing levels client-side. Output validated against the shared contract.
import { listGoverningBodies } from '../../../db/repositories/affiliations'
import { governingBodyListSchema } from '../../../../shared/contracts/affiliation'

export default defineEventHandler(async (event) => {
  const excludeOrgId = getQuery(event).excludeOrgId
  if (!excludeOrgId || typeof excludeOrgId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'excludeOrgId is required' })
  }
  const bodies = await listGoverningBodies(excludeOrgId)
  return governingBodyListSchema.parse(bodies)
})
