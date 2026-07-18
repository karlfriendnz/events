// GET /api/v1/person-type-links/hydrated?orgIds=a,b,c — links whose owner AND source
// both sit in the reachable set (org + governing chain), hydrated with the source
// type's key/label/org — the payload resolution needs. A link whose source is outside
// the set is dropped (a disconnected sport's fields stop flowing).
import { listTypeLinksHydrated } from '../../../db/repositories/personTypes'
import { hydratedTypeLinkListSchema } from '../../../../shared/contracts/personType'

export default defineEventHandler(async (event) => {
  const raw = getQuery(event).orgIds
  const orgIds = (typeof raw === 'string' ? raw : '').split(',').map((s) => s.trim()).filter(Boolean)
  return hydratedTypeLinkListSchema.parse(await listTypeLinksHydrated(orgIds))
})
