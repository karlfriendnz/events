// GET /api/v1/forms?orgId= — every registration form for an org. The client only
// ever talks to routes like this, never to the database. Output is validated against
// the shared contract before it leaves, so the client's types are guaranteed.
import { listForms } from '../../../db/repositories/forms'
import { registrationFormListSchema } from '../../../../shared/contracts/form'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const forms = await listForms(orgId)
  return registrationFormListSchema.parse(forms)
})
