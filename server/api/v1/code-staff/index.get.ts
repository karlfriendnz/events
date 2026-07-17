// GET /api/v1/code-staff?orgId=… — code-level staff assignments for an org. Backs the
// useRolesApi().codeStaff() composable method. Output is validated against the shared
// contract before it leaves, so the client's types are guaranteed.
import { listCodeStaff } from '../../../db/repositories/roles'
import { codeStaffListSchema } from '../../../../shared/contracts/role'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId as string | undefined
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const staff = await listCodeStaff(orgId)
  return codeStaffListSchema.parse(staff)
})
