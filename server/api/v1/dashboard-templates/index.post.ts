// POST /api/v1/dashboard-templates — upsert a per-role dashboard template (the
// /dashboard template-edit-mode Save). Body: { orgId, userType, config }.
import { z } from 'zod'
import { saveDashboardTemplate } from '../../../db/repositories/admin'

const bodySchema = z.object({
  orgId: z.string().min(1),
  userType: z.string().min(1),
  config: z.any(),
})

export default defineEventHandler(async (event) => {
  const { orgId, userType, config } = bodySchema.parse(await readBody(event))
  await saveDashboardTemplate(orgId, userType, config)
  return { ok: true }
})
