// PATCH /api/v1/organisations/:id/people-columns — save the People directory's
// per-tab visible-column selection. A focused settings write, not a general org edit.
import { setPeopleColumns } from '../../../../db/repositories/organisations'
import { peopleColumnsPatchSchema } from '../../../../../shared/contracts/orgSettings'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { peopleColumns } = peopleColumnsPatchSchema.parse(await readBody(event))
  await setPeopleColumns(id, peopleColumns)
  return { ok: true }
})
