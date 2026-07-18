// The client side of the seam for attendance (the per-session sign-in ledger).
// Components call this — never useDb(). Typed $fetch to /api/v1/attendance/*, returning
// the shared contract shape.
import type { AttendanceRow, AttendanceCreate, AttendanceCount } from '../shared/contracts/attendance'

export function useAttendanceApi() {
  /** Attendance rows for one session (present-only by default). */
  async function bySession(sessionId: string, onlyAttended = true): Promise<AttendanceRow[]> {
    return await $fetch<AttendanceRow[]>('/api/v1/attendance', {
      query: { sessionId, onlyAttended: onlyAttended ? undefined : '0' },
    })
  }
  /** Attendance rows for a SET of sessions (present-only by default). */
  async function bySessions(sessionIds: string[], onlyAttended = true): Promise<AttendanceRow[]> {
    if (!sessionIds.length) return []
    return await $fetch<AttendanceRow[]>('/api/v1/attendance', {
      query: { sessionIds: sessionIds.join(','), onlyAttended: onlyAttended ? undefined : '0' },
    })
  }
  /** Attendance rows for a SET of events (EVENT-level, present-only by default) —
   *  training events attach attendance to the event, not a session. */
  async function byEvents(eventIds: string[], onlyAttended = true): Promise<AttendanceRow[]> {
    if (!eventIds.length) return []
    return await $fetch<AttendanceRow[]>('/api/v1/attendance', {
      query: { eventIds: eventIds.join(','), onlyAttended: onlyAttended ? undefined : '0' },
    })
  }
  /** Per-event distinct-attendee counts across a whole org (reporting rollup). */
  async function countsByOrg(orgId: string): Promise<AttendanceCount[]> {
    return await $fetch<AttendanceCount[]>('/api/v1/attendance/counts', { query: { orgId } })
  }
  /** Mark one person present for a session. */
  async function create(input: AttendanceCreate): Promise<AttendanceRow> {
    return await $fetch<AttendanceRow>('/api/v1/attendance', { method: 'POST', body: input })
  }
  /** Bulk sign-in — one call, N rows. Returns the created rows. */
  async function createMany(rows: AttendanceCreate[]): Promise<AttendanceRow[]> {
    if (!rows.length) return []
    return await $fetch<AttendanceRow[]>('/api/v1/attendance', { method: 'POST', body: { rows } })
  }
  /** Remove one attendance (sign-out toggle-off). */
  async function remove(id: string): Promise<void> {
    await $fetch(`/api/v1/attendance/${id}`, { method: 'DELETE' })
  }

  return { bySession, bySessions, byEvents, countsByOrg, create, createMany, remove }
}
