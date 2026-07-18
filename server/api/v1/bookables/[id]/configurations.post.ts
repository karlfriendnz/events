// POST /api/v1/bookables/:id/configurations — idempotent slot-aware save of one
// configuration (key + name + slots). Returns { configId }.
import { saveConfiguration } from '../../../../db/repositories/bookings'
import { z } from 'zod'

const bodySchema = z.object({
  key: z.string(),
  name: z.string(),
  slots: z.array(z.object({ name: z.string(), childIds: z.array(z.string()) })),
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { key, name, slots } = bodySchema.parse(await readBody(event))
  const configId = await saveConfiguration(id, key, name, slots)
  return { configId }
})
