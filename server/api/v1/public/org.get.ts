// GET /api/v1/public/org?org=<id> — the PUBLIC presentation of one org (name +
// branding + booker theme). Anonymous: this whole /api/v1/public/** prefix is the
// intended unauthenticated surface — the backend team's auth middleware allow-lists
// exactly this prefix. Parse-on-output keeps the exposed shape locked to the contract.
import { publicOrg } from '../../../db/repositories/public'
import { publicOrgSchema } from '../../../../shared/contracts/public'

export default defineEventHandler(async (event) => {
  const org = String(getQuery(event).org ?? '')
  if (!org) throw createError({ statusCode: 400, statusMessage: 'org is required' })
  const row = await publicOrg(org)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Organisation not found' })
  return publicOrgSchema.parse(row)
})
