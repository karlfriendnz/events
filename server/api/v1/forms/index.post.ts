// POST /api/v1/forms — create a registration form.
import { createForm } from '../../../db/repositories/forms'
import { registrationFormCreateSchema, registrationFormSchema } from '../../../../shared/contracts/form'

export default defineEventHandler(async (event) => {
  const input = registrationFormCreateSchema.parse(await readBody(event))
  return registrationFormSchema.parse(await createForm(input))
})
