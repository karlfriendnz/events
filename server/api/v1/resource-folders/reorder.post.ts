// POST /api/v1/resource-folders/reorder — bulk reorder by an ordered id list.
// Org-scoped in the WHERE (never trust the id list alone).
import { reorderFolders } from '../../../db/repositories/resources'
import { resourceReorderSchema } from '../../../../shared/contracts/resource'

export default defineEventHandler(async (event) => {
  const { orgId, ids } = resourceReorderSchema.parse(await readBody(event))
  await reorderFolders(orgId, ids)
  return { ok: true }
})
