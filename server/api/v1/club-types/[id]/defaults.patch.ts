// PATCH /api/v1/club-types/:id/defaults — save a club type's setup-template
// payloads (default modules / person types / terminology). json bodies stay `any`.
import { saveClubTypeDefaults } from '../../../../db/repositories/admin'
import { clubTypeDefaultsSchema } from '../../../../../shared/contracts/admin'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  const defaults = clubTypeDefaultsSchema.parse(await readBody(event))
  await saveClubTypeDefaults(id, defaults)
  return { ok: true }
})
