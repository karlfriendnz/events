// GET /api/v1/admin/organisations — the super-admin cross-org table: every
// non-sandbox org + brand/type wiring + member/event counts. Not org-scoped
// (platform-wide overview).
import { listOrgsWithCounts } from '../../../../db/repositories/admin'
import { orgAdminRowListSchema } from '../../../../../shared/contracts/admin'

export default defineEventHandler(async () => {
  const rows = await listOrgsWithCounts()
  return orgAdminRowListSchema.parse(rows)
})
