// POST /api/v1/attendance — mark attendance. Body is either one AttendanceCreate (→ one
// row) or { rows: AttendanceCreate[] } for a bulk sign-in. Returns the created row(s).
import { createAttendance, createAttendanceMany } from '../../../db/repositories/attendance'
import {
  attendanceCreateSchema,
  attendanceCreateManySchema,
  attendanceSchema,
  attendanceListSchema,
} from '../../../../shared/contracts/attendance'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (body && typeof body === 'object' && Array.isArray((body as any).rows)) {
    const { rows } = attendanceCreateManySchema.parse(body)
    return attendanceListSchema.parse(await createAttendanceMany(rows))
  }
  const input = attendanceCreateSchema.parse(body)
  return attendanceSchema.parse(await createAttendance(input))
})
