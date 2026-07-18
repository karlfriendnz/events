// PATCH /api/v1/admin/organisations/:id/modules — persist the enabled non-core
// module keys (null = reset to all-on).
import { z } from 'zod'
import { setOrgModules } from '../../../../../db/repositories/admin'

const bodySchema = z.object({ enabledModules: z.array(z.string()).nullable() })

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  const { enabledModules } = bodySchema.parse(await readBody(event))
  await setOrgModules(id, enabledModules)
  return { ok: true }
})
