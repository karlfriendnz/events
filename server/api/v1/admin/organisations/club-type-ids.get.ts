// GET /api/v1/admin/organisations/club-type-ids?ids=a,b,c — the club-type ids
// (+ name) for a set of orgs, for governing-chain inheritance resolution. Static
// route (wins over the [id] dynamic dir).
import { listOrgClubTypeIds } from '../../../../db/repositories/admin'
import { orgClubTypeIdsListSchema } from '../../../../../shared/contracts/admin'

export default defineEventHandler(async (event) => {
  const raw = getQuery(event).ids
  const ids = String(raw ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const rows = await listOrgClubTypeIds(ids)
  return orgClubTypeIdsListSchema.parse(rows)
})
