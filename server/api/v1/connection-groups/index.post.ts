// POST /api/v1/connection-groups — create a saved invitee set.
import { createConnectionGroup } from '../../../db/repositories/events'
import { connectionGroupSchema } from '../../../../shared/contracts/event'
import { z } from 'zod'

const bodySchema = z.object({ orgId: z.string(), name: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const input = bodySchema.parse(await readBody(event))
  return connectionGroupSchema.parse(await createConnectionGroup(input))
})
