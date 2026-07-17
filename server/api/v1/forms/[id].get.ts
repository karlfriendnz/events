// GET /api/v1/forms/:id — one registration form. 404 when it doesn't exist. Output
// validated against the shared contract before it leaves the seam.
import { getForm } from '../../../db/repositories/forms'
import { registrationFormSchema } from '../../../../shared/contracts/form'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'id is required' })
  }
  const form = await getForm(id)
  if (!form) {
    throw createError({ statusCode: 404, statusMessage: 'Form not found' })
  }
  return registrationFormSchema.parse(form)
})
