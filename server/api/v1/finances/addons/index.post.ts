// POST /api/v1/finances/addons — create an add-on on an event.
import { createAddon } from '../../../../db/repositories/finances'
import { addonCreateSchema, addonSchema } from '../../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const input = addonCreateSchema.parse(await readBody(event))
  const created = await createAddon(input)
  if (!created) throw createError({ statusCode: 500, statusMessage: 'create failed' })
  return addonSchema.parse(created)
})
