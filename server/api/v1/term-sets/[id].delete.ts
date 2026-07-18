// DELETE /api/v1/term-sets/:id — remove a set (its terms fall back to the default
// sequence via the FK's ON DELETE SET NULL).
import { deleteTermSet } from '../../../db/repositories/memberships'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  await deleteTermSet(id)
  return { ok: true }
})
