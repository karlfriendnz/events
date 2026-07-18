// POST /api/v1/resources/reorder — bulk reorder by an ordered id list.
// Org-scoped in the WHERE (never trust the id list alone).
import { reorderResources } from '../../../db/repositories/resources'
import { resourceReorderSchema } from '../../../../shared/contracts/resource'

export default defineEventHandler(async (event) => {
  const { orgId, ids } = resourceReorderSchema.parse(await readBody(event))
  await reorderResources(orgId, ids)
  return { ok: true }
})
