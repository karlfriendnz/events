// The repository for the attendance domain — the ONLY code that knows how the
// per-session sign-in ledger is stored. Routes call these; they never touch Drizzle.
//
// attendance rows are keyed on (person, session) with an `attended` flag + the
// denormalised event_id. There is no org_id, so the org-wide reporting rollup joins
// attendance → events to scope by org.
import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../client'
import type { AttendanceRow, AttendanceCreate, AttendanceCount } from '../../../shared/contracts/attendance'

function toIso(v: unknown): string | null {
  if (v == null) return null
  const d = v instanceof Date ? v : new Date(v as any)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function toRow(r: typeof schema.attendance.$inferSelect): AttendanceRow {
  return {
    id: r.id,
    eventId: r.eventId,
    sessionId: r.sessionId ?? null,
    personId: r.personId,
    attended: r.attended,
    markedAt: toIso(r.markedAt),
    markedBy: r.markedBy ?? null,
  }
}

/** Attendance rows for one session (defaults to only those marked present). */
export async function listBySession(sessionId: string, onlyAttended = true): Promise<AttendanceRow[]> {
  const preds: any[] = [eq(schema.attendance.sessionId, sessionId)]
  if (onlyAttended) preds.push(eq(schema.attendance.attended, true))
  const rows = await db.select().from(schema.attendance).where(and(...preds))
  return rows.map(toRow)
}

/** Attendance rows for a SET of sessions (present-only by default). */
export async function listBySessions(sessionIds: string[], onlyAttended = true): Promise<AttendanceRow[]> {
  if (!sessionIds.length) return []
  const preds: any[] = [inArray(schema.attendance.sessionId, sessionIds)]
  if (onlyAttended) preds.push(eq(schema.attendance.attended, true))
  const rows = await db.select().from(schema.attendance).where(and(...preds))
  return rows.map(toRow)
}

/**
 * Per-event distinct-attendee counts for a whole org — the reporting rollup. Joins
 * attendance → events to scope by org (attendance has no org_id), counts DISTINCT
 * persons with ≥1 attended row per event. One query, reduced in JS.
 */
export async function attendedCountsByOrg(orgId: string): Promise<AttendanceCount[]> {
  const rows = await db
    .select({ eventId: schema.attendance.eventId, personId: schema.attendance.personId })
    .from(schema.attendance)
    .innerJoin(schema.events, eq(schema.attendance.eventId, schema.events.id))
    .where(and(eq(schema.events.orgId, orgId), eq(schema.attendance.attended, true)))
  const byEvent: Record<string, Set<string>> = {}
  for (const r of rows) (byEvent[r.eventId] ||= new Set()).add(r.personId)
  return Object.entries(byEvent).map(([eventId, set]) => ({ eventId, count: set.size }))
}

// ── Writes ──
// The repo owns the id. `attended` defaults true (a sign-in). markedAt/markedBy carried
// but optional. `as any` on the insert — the schema over-requires notNull cols the DB
// defaults (consistent with the app's insert idiom).
export async function createAttendance(input: AttendanceCreate): Promise<AttendanceRow> {
  const id = randomUUID()
  await db.insert(schema.attendance).values({
    id,
    eventId: input.eventId,
    sessionId: input.sessionId ?? null,
    personId: input.personId,
    attended: input.attended ?? true,
    markedAt: input.markedAt ? new Date(input.markedAt) : new Date(),
    markedBy: input.markedBy ?? null,
  } as any)
  const [r] = await db.select().from(schema.attendance).where(eq(schema.attendance.id, id)).limit(1)
  return toRow(r)
}

/** Bulk sign-in — insert N rows in one call, returning the created rows. */
export async function createAttendanceMany(inputs: AttendanceCreate[]): Promise<AttendanceRow[]> {
  const out: AttendanceRow[] = []
  for (const input of inputs) out.push(await createAttendance(input))
  return out
}

export async function deleteAttendance(id: string): Promise<void> {
  await db.delete(schema.attendance).where(eq(schema.attendance.id, id))
}
