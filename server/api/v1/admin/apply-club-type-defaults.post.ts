// POST /api/v1/admin/apply-club-type-defaults — seed a newly-created club from its
// club types' setup templates (modules / person types / terminology / starting
// dashboards). Runs the whole operation server-side so the composable is one call.
// defaultDashboardFor is a PURE helper (no Nuxt runtime) imported from the shared
// permissions registry, passed into the repo.
import { z } from 'zod'
import { applyClubTypeDefaults } from '../../../db/repositories/admin'
import { defaultDashboardFor } from '../../../../composables/usePermissions'

const bodySchema = z.object({ orgId: z.string().min(1), typeIds: z.array(z.string()) })

export default defineEventHandler(async (event) => {
  const { orgId, typeIds } = bodySchema.parse(await readBody(event))
  await applyClubTypeDefaults(orgId, typeIds, defaultDashboardFor)
  return { ok: true }
})
