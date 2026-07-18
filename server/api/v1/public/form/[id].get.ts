// GET /api/v1/public/form/:id — one registration form's config + the classes it's
// connected to (targets → member_groups, expanding code/programme targets), each with
// live spaces + fee options for the in-form "choose your class" block. 404 when the
// form doesn't exist.
import { publicForm } from '../../../../db/repositories/public'
import { publicFormSchema } from '../../../../../shared/contracts/public'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  const f = await publicForm(id)
  if (!f) throw createError({ statusCode: 404, statusMessage: 'This form could not be found.' })
  return publicFormSchema.parse(f)
})
