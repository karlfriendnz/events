// POST /api/v1/org-sports/clear-primary — clear the primary flag on every one of a
// club's sports. Run before setting a new primary so the one-primary unique index
// never trips mid-write. Org-scoped in the repo WHERE.
import { z } from 'zod'
import { clearPrimarySports } from '../../../db/repositories/affiliations'

const bodySchema = z.object({ orgId: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const { orgId } = bodySchema.parse(await readBody(event))
  await clearPrimarySports(orgId)
  return { ok: true }
})
