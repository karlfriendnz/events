// POST /api/v1/dev/reset — clear an org's data, or delete an org tree. DEV-GATED:
// refused in production unless ALLOW_DEV_SEED=1 (the real gate — super-admin auth —
// is the backend team's later).
import { resetRequestSchema, resetSummarySchema } from '../../../../shared/contracts/devSeed'
import { resetOrgData, deleteOrgTree } from '../../../db/seed/reset'

export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_SEED !== '1') {
    throw createError({ statusCode: 403, statusMessage: 'dev seeding disabled in production' })
  }
  const { orgId, mode } = resetRequestSchema.parse(await readBody(event))
  if (mode === 'org-tree') await deleteOrgTree(orgId)
  else await resetOrgData(orgId)
  return resetSummarySchema.parse({ ok: true, mode })
})
