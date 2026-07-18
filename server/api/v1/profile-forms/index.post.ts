// POST /api/v1/profile-forms — upsert the form LAYOUT for one person type (on the
// (org_id, type_key) key). Body validated against the save contract.
import { saveProfileForm } from '../../../db/repositories/personTypes'
import { profileFormSaveSchema } from '../../../../shared/contracts/personType'

export default defineEventHandler(async (event) => {
  const { orgId, typeKey, config } = profileFormSaveSchema.parse(await readBody(event))
  await saveProfileForm(orgId, typeKey, config)
  return { ok: true }
})
