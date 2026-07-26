// DELETE /api/v1/people/:id/override?orgId=… — discard a governing body's private
// edits on this person (revert to the club's values). Never touches the person row.
import { deletePersonOverride } from '../../../../db/repositories/people'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) throw createError({ statusCode: 400, statusMessage: 'orgId required' })
  await deletePersonOverride(orgId, id)
  return { ok: true }
})
