// DELETE /api/v1/attendance/:id — remove one attendance (sign-out toggle-off).
import { deleteAttendance } from '../../../db/repositories/attendance'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  await deleteAttendance(id)
  return { ok: true }
})
