// POST /api/v1/org-sports — create a club sport / governing-body affiliation.
import { createOrgSport } from '../../../db/repositories/affiliations'
import { orgSportCreateSchema, orgSportSchema } from '../../../../shared/contracts/affiliation'

export default defineEventHandler(async (event) => {
  const input = orgSportCreateSchema.parse(await readBody(event))
  return orgSportSchema.parse(await createOrgSport(input))
})
