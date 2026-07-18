// GET /api/v1/admin/sandbox-org — the hidden Template Sandbox org's id (the preview
// canvas for dashboard templates), or null.
import { getSandboxOrgId } from '../../../db/repositories/admin'
import { idResultSchema } from '../../../../shared/contracts/admin'

export default defineEventHandler(async () => {
  const id = await getSandboxOrgId()
  return idResultSchema.parse({ id })
})
