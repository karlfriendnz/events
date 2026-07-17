// POST /api/v1/entities — create. Validates the body against the create contract
// (parse-on-input), returns the created row validated against the read contract
// (parse-on-output). The write mirror of index.get.
import { createEntity } from '../../../db/repositories/circles'
import { entityCreateSchema, entitySchema } from '../../../../shared/contracts/circle'

export default defineEventHandler(async (event) => {
  const input = entityCreateSchema.parse(await readBody(event))
  return entitySchema.parse(await createEntity(input))
})
