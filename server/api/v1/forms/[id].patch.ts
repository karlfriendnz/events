// PATCH /api/v1/forms/:id — partial update (rename / overwrite config). Coexists
// with [id].get.ts and the [id]/ dir (targets) — different route, no conflict.
import { updateForm } from '../../../db/repositories/forms'
import { registrationFormPatchSchema, registrationFormSchema } from '../../../../shared/contracts/form'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const patch = registrationFormPatchSchema.parse(await readBody(event))
  const updated = await updateForm(id, patch)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return registrationFormSchema.parse(updated)
})
