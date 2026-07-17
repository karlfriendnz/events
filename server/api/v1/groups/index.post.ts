// POST /api/v1/groups — create a group. Validates the body against the create
// contract (parse-on-input), returns the created row validated against the read
// contract (parse-on-output). The write mirror of index.get.
import { createGroup } from '../../../db/repositories/groups'
import { memberGroupCreateSchema, memberGroupSchema } from '../../../../shared/contracts/group'

export default defineEventHandler(async (event) => {
  const input = memberGroupCreateSchema.parse(await readBody(event))
  return memberGroupSchema.parse(await createGroup(input))
})
