// GET /api/v1/forms/:id/targets — the connections of one form (the codes / groups it
// registers into). Output validated against the shared contract before it leaves.
import { listTargets } from '../../../../db/repositories/forms'
import { registrationFormTargetListSchema } from '../../../../../shared/contracts/form'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'id is required' })
  }
  const targets = await listTargets(id)
  return registrationFormTargetListSchema.parse(targets)
})
