// POST /api/v1/forms/:id/targets — replace the whole connection set of a form
// (delete-then-insert). Body: { orgId, targets: [{ targetType, targetId, sortOrder }] }.
import { saveTargets } from '../../../../db/repositories/forms'
import { saveTargetsSchema } from '../../../../../shared/contracts/form'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'id is required' })
  }
  const { orgId, targets } = saveTargetsSchema.parse(await readBody(event))
  await saveTargets(id, orgId, targets)
  return { ok: true, count: targets.length }
})
