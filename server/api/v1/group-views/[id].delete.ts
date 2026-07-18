// DELETE /api/v1/group-views/:id — remove a saved view.
import { deleteView } from '../../../db/repositories/groups'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  await deleteView(id)
  return { ok: true }
})
