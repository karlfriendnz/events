// GET /api/v1/terminology/sport?orgId=…&sportId=… — a sport's terminology overrides:
// an explicit sport by id, or (sportId omitted) the org's PRIMARY sport. null when
// there's no such sport row / no overrides.
import { getSportTerminology } from '../../../db/repositories/personTypes'
import { terminologyMapSchema } from '../../../../shared/contracts/personType'

const outSchema = terminologyMapSchema.nullable()

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const orgId = q.orgId
  if (typeof orgId !== 'string' || !orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  const sportId = typeof q.sportId === 'string' && q.sportId ? q.sportId : null
  return outSchema.parse(await getSportTerminology(orgId, sportId))
})
