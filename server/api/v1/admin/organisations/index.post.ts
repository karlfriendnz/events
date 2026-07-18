// POST /api/v1/admin/organisations — create an org from the admin dashboard (the
// FULL row: type / level / parent / default sport / brand / club types). Returns
// its new id (the caller then seeds club-type defaults separately).
import { createOrgAdmin } from '../../../../db/repositories/admin'
import { orgAdminCreateSchema, idResultSchema } from '../../../../../shared/contracts/admin'

export default defineEventHandler(async (event) => {
  const input = orgAdminCreateSchema.parse(await readBody(event))
  const { id } = await createOrgAdmin(input)
  return idResultSchema.parse({ id })
})
