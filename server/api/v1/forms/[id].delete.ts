// DELETE /api/v1/forms/:id?orgId= — delete a form. When orgId is given, the delete
// also DETACHES everything pointing at it (events / booking modes / classes get their
// form_id nulled, fields + connections removed) and is org-scoped so a form can't be
// removed cross-tenant. Without orgId it falls back to a plain row delete (back-compat).
import { deleteForm, deleteFormAndDetach } from '../../../db/repositories/forms'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const orgId = getQuery(event).orgId
  if (typeof orgId === 'string' && orgId) await deleteFormAndDetach(id, orgId)
  else await deleteForm(id)
  return { ok: true }
})
