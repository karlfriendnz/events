// POST /api/v1/admin/permission-templates/reorder — persist a new sort_order for
// each (saved, core) template row after a drag-reorder.
import { reorderCorePermissionGroups } from '../../../../db/repositories/admin'
import { reorderListSchema } from '../../../../../shared/contracts/admin'

export default defineEventHandler(async (event) => {
  const items = reorderListSchema.parse(await readBody(event))
  await reorderCorePermissionGroups(items)
  return { ok: true, count: items.length }
})
