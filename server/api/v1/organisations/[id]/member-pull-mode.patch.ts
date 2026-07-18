// PATCH /api/v1/organisations/:id/member-pull-mode — set the cross-club member-pull
// policy. Body { memberPullMode: 'reference' | 'copy' | null }. The READ side is on
// getSettings().memberPullMode.
import { setMemberPullMode } from '../../../../db/repositories/organisations'
import { orgMemberPullModeSchema } from '../../../../../shared/contracts/organisation'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const { memberPullMode } = orgMemberPullModeSchema.parse(await readBody(event))
  await setMemberPullMode(id, memberPullMode)
  return { ok: true }
})
