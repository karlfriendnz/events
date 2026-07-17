// POST /api/v1/group-codes — create a code. Validates the body against the create
// contract (parse-on-input), returns the created row validated against the read
// contract (parse-on-output). The write mirror of index.get.
import { createCode } from '../../../db/repositories/groups'
import { groupCodeCreateSchema, groupCodeSchema } from '../../../../shared/contracts/group'

export default defineEventHandler(async (event) => {
  const input = groupCodeCreateSchema.parse(await readBody(event))
  return groupCodeSchema.parse(await createCode(input))
})
