// POST /api/v1/circles — create a circle (family or circle). Validates the body against
// the create contract, returns the created row against the read contract.
import { createCircle } from '../../../db/repositories/circles'
import { circleCreateSchema, circleSchema } from '../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const input = circleCreateSchema.parse(await readBody(event))
  return circleSchema.parse(await createCircle(input))
})
