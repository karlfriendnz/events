// POST /api/v1/resource-targets/save — replace one owner's whole audience
// (delete-then-insert). Returns the number of target rows written.
import { saveTargets } from '../../../db/repositories/resources'
import { resourceTargetsSaveSchema } from '../../../../shared/contracts/resource'

export default defineEventHandler(async (event) => {
  const input = resourceTargetsSaveSchema.parse(await readBody(event))
  const count = await saveTargets(input)
  return { count }
})
