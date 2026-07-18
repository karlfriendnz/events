// POST /api/v1/org-manager-grants/replace — replace a person's cross-club manager
// grants at a governing org (delete-then-insert). Org-scoped in the repo WHERE so a
// crafted person id can't reach another tenant.
import { replaceManagerGrants } from '../../../db/repositories/affiliations'
import { orgManagerGrantSaveSchema } from '../../../../shared/contracts/affiliation'

export default defineEventHandler(async (event) => {
  const { orgId, personId, grants } = orgManagerGrantSaveSchema.parse(await readBody(event))
  await replaceManagerGrants(orgId, personId, grants)
  return { ok: true, count: grants.length }
})
