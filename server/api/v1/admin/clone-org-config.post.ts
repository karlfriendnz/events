// POST /api/v1/admin/clone-org-config — clone a TEMPLATE org's config/structure into a
// freshly-created org (config only — never people or operational data). Runs INSTEAD of
// apply-club-type-defaults when a club is created from a template.
import { z } from 'zod'
import { cloneOrgConfig } from '../../../db/repositories/admin'

const bodySchema = z.object({ templateOrgId: z.string().min(1), targetOrgId: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const { templateOrgId, targetOrgId } = bodySchema.parse(await readBody(event))
  await cloneOrgConfig(templateOrgId, targetOrgId)
  return { ok: true }
})
