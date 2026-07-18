// The CONTRACT for the attendance domain: Zod schemas + inferred types shared by the
// client (typed composable) and the server (Nitro route output validation). DB-neutral
// like every other contract — the UI only ever sees plain fields, the repo mapper owns
// storage (Date→ISO, decimals, etc).
//
// attendance is the per-session sign-in ledger: one row per (person, session) marked
// present. It has no org_id — a child of events (event_id), scoped by joining to
// events for the org-wide reporting rollup.
import { z } from 'zod'

export const attendanceSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  sessionId: z.string().nullable(),
  personId: z.string(),
  attended: z.boolean(),
  markedAt: z.string().nullable(),
  markedBy: z.string().nullable(),
})
export type AttendanceRow = z.infer<typeof attendanceSchema>
export const attendanceListSchema = z.array(attendanceSchema)

// WRITE contract. Create omits the server-owned id; eventId + personId are required,
// the rest default in the repo/DB.
export const attendanceCreateSchema = attendanceSchema.omit({ id: true }).partial({
  sessionId: true, attended: true, markedAt: true, markedBy: true,
})
export type AttendanceCreate = z.infer<typeof attendanceCreateSchema>

// Bulk create — one POST body carrying N rows (attendance-tab "Mark Selected In").
export const attendanceCreateManySchema = z.object({
  rows: z.array(attendanceCreateSchema),
})

// Per-event distinct-attendee counts across a whole org — the reporting rollup
// (distinct persons with ≥1 attended record, grouped by event).
export const attendanceCountSchema = z.object({
  eventId: z.string(),
  count: z.number().int(),
})
export type AttendanceCount = z.infer<typeof attendanceCountSchema>
export const attendanceCountListSchema = z.array(attendanceCountSchema)
